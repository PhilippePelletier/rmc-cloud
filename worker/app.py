import os
import json
from datetime import datetime
from io import StringIO
from typing import Tuple, Optional, List, Dict, Any

import pandas as pd
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from jinja2 import Template
from sqlalchemy import create_engine, text
from supabase import create_client, Client
import openai
from weasyprint import HTML

# -----------------------------------------------------------------------------
# Configuration and initialization
# -----------------------------------------------------------------------------
app = FastAPI(title="RMC Cloud Worker")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_DB_URL = os.getenv("SUPABASE_DB_URL")
SECRET = os.getenv("WORKER_SHARED_SECRET", "")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if OPENAI_API_KEY:
    openai.api_key = OPENAI_API_KEY

# Supabase client (for Storage and REST API operations)
supa: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
# SQLAlchemy engine for direct Postgres access
engine = create_engine(SUPABASE_DB_URL, future=True)

# Jinja2 template for the brief
BRIEF_MD_TEMPLATE = Template("""
# Weekly Brief — {{ week }}

## Executive Summary

{{ narrative }}

## KPIs

- **Revenue:** ${{ revenue|round(0)|int }}
- **Gross Margin ($):** ${{ gm_dollar|round(0)|int }}
- **Gross Margin (%):** {{ (gm_pct * 100)|round(1) }}%
- **Units Sold:** {{ units|round(0)|int }}

## Top Categories

{% for row in top_categories %}
- **{{ row.category }}:** ${{ row.revenue|round(0)|int }} (GM%: {{ (row.gm_pct * 100)|round(1) }}%)
{% endfor %}

## Anomalies

{% if anomalies %}
{% for a in anomalies %}
- On {{ a.date }}, **{{ a.category }}** revenue was {{ a.delta_pct|round(1) }}% off the mean (revenue: ${{ a.revenue|round(0)|int }})
{% endfor %}
{% else %}
No anomalies detected this week.
{% endif %}

""".lstrip())

# -----------------------------------------------------------------------------
# Helper functions
# -----------------------------------------------------------------------------
def aggregate(org_id: str) -> Optional[Tuple[pd.DataFrame, pd.DataFrame]]:
    """Read raw sales data and compute daily aggregates."""
    with engine.begin() as conn:
        df = pd.read_sql(
            text("SELECT date, store_id, category, units, net_sales, cost "
                 "FROM sales WHERE org_id = :o"),
            conn,
            params={"o": org_id},
        )
    if df.empty:
        return None
    df["gm_dollar"] = df["net_sales"] - df["cost"]
    daily = (
        df.groupby(["date", "store_id", "category"], as_index=False)
        .agg(
            units=("units", "sum"),
            net_sales=("net_sales", "sum"),
            gm_dollar=("gm_dollar", "sum"),
        )
    )
    daily["gm_pct"] = (daily["gm_dollar"] / daily["net_sales"]).fillna(0)
    return df, daily

def upsert_table(conn, org_id: str, df: pd.DataFrame, table: str) -> None:
    """Insert a DataFrame into a target table, adding org_id."""
    df = df.copy()
    df["org_id"] = org_id
    df.to_sql(table, conn, if_exists="append", index=False)

def compute_metrics(raw: pd.DataFrame, daily: pd.DataFrame) -> Dict[str, Any]:
    """Compute overall KPIs, top categories and anomalies."""
    revenue   = float(daily["net_sales"].sum())
    gm_dollar = float(daily["gm_dollar"].sum())
    gm_pct    = revenue and gm_dollar / revenue or 0
    units     = float(daily["units"].sum())

    # Top categories
    cats = (
        daily.groupby("category")
        .agg(revenue=("net_sales", "sum"), gm=("gm_dollar", "sum"), units=("units", "sum"))
        .reset_index()
    )
    cats["gm_pct"] = cats["gm"] / cats["revenue"].replace({0: 1})
    top_categories = (
        cats.sort_values("revenue", ascending=False)
        .head(5)
        .rename(columns={"gm": "gm_dollar"})
        .to_dict(orient="records")
    )

    # Anomaly detection (2-sigma rule per category)
    anomalies: List[Dict[str, Any]] = []
    for cat, group in daily.groupby("category"):
        vals = group["net_sales"].astype(float)
        mean = vals.mean()
        std  = vals.std(ddof=0) or 1e-9
        for date, revenue_val in zip(group["date"], vals):
            if abs(revenue_val - mean) > 2 * std:
                delta_pct = (revenue_val - mean) / mean * 100 if mean else 0
                anomalies.append({
                    "date": str(date),
                    "category": cat or "Uncategorized",
                    "revenue": float(revenue_val),
                    "delta_pct": float(delta_pct),
                })

    return {
        "revenue": revenue,
        "gm_dollar": gm_dollar,
        "gm_pct": gm_pct,
        "units": units,
        "top_categories": top_categories,
        "anomalies": anomalies,
    }

def generate_ai_narrative(metrics: Dict[str, Any]) -> str:
    """Call OpenAI to generate the narrative based on aggregated metrics."""
    if not openai.api_key:
        return "AI narrative is unavailable (no API key configured)."
    prompt = f"""
You are an AI assistant who creates a weekly business brief for a small retailer.
Below are the aggregated metrics for the week. Please:
1. Summarise the overall performance (revenue, gross margin, units).
2. Highlight the top- and bottom-performing categories and any significant changes.
3. Explain the detected anomalies and why they matter.
4. Suggest up to three actionable steps for the next week.

Only use the numbers provided; do not fabricate any additional data.

Metrics:
{json.dumps(metrics, indent=2)}
"""
    try:
        resp = openai.ChatCompletion.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a helpful business analyst."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            max_tokens=800,
        )
        return resp.choices[0].message["content"].strip()
    except Exception as e:
        # Log the error and return a fallback narrative
        print(f"AI generation failed: {e}")
        return "AI narrative could not be generated this week due to an internal error."

def download_csv(bucket: str, path: str) -> pd.DataFrame:
    """Download a CSV file from Supabase Storage and return a DataFrame."""
    res: bytes = supa.storage.from_(bucket).download(path)
    return pd.read_csv(StringIO(res.decode("utf-8")))

# -----------------------------------------------------------------------------
# Job processing endpoint
# -----------------------------------------------------------------------------
@app.post("/jobs/process")
async def process(req: Request):
    """Process a queued job: validate secret, ingest CSV, recompute aggregates and generate brief."""
    # Authentication using a shared secret
    if req.headers.get("x-rmc-secret", "") != SECRET:
        raise HTTPException(status_code=401, detail="unauthorized")

    payload = await req.json()
    job_id = int(payload.get("job_id", 0))

    # Fetch job record
    job = supa.table("jobs").select("*").eq("id", job_id).single().execute().data
    if not job:
        raise HTTPException(status_code=404, detail="job not found")

    org_id: str = job["org_id"]
    kind: str   = job["kind"]
    path: str   = job["path"]

    # Mark job as running
    supa.table("jobs").update({"status": "running"}).eq("id", job_id).execute()

    try:
        # Download uploaded CSV
        df = download_csv("rmc-uploads", path)

        # Ingest raw CSV into the appropriate table
        with engine.begin() as conn:
            if kind == "sales":
                required_cols = ["date","store_id","sku","product_name","units","net_sales","discount","cost","category","sub_category"]
                df = df[required_cols]
                upsert_table(conn, org_id, df, "sales")
            elif kind == "product_master":
                upsert_table(conn, org_id, df, "products")
            elif kind == "store_master":
                upsert_table(conn, org_id, df, "stores")
            elif kind == "promo_calendar":
                upsert_table(conn, org_id, df, "promos")
            else:
                raise ValueError(f"Unsupported CSV kind: {kind}")

        # Recompute aggregates and brief
        agg = aggregate(org_id)
        if agg:
            raw, daily = agg
            with engine.begin() as conn:
                conn.execute(text("DELETE FROM daily_agg WHERE org_id = :o"), {"o": org_id})
                daily["org_id"] = org_id
                daily.to_sql("daily_agg", conn, if_exists="append", index=False)

            # Compute metrics and AI narrative
            metrics   = compute_metrics(raw, daily)
            narrative = generate_ai_narrative(metrics)

            # Render Markdown using the Jinja template
            week = datetime.utcnow().date().isoformat()
            brief_md = BRIEF_MD_TEMPLATE.render(
                week=week,
                narrative=narrative,
                revenue=metrics["revenue"],
                gm_dollar=metrics["gm_dollar"],
                gm_pct=metrics["gm_pct"],
                units=metrics["units"],
                top_categories=metrics["top_categories"],
                anomalies=metrics["anomalies"],
            )

            # Save brief record to DB
            with engine.begin() as conn:
                r = conn.execute(
                    text("INSERT INTO briefs (org_id, content_md) VALUES (:o, :m) RETURNING id"),
                    {"o": org_id, "m": brief_md},
                ).first()
                brief_id = r[0]

            # Convert Markdown to PDF
            pdf_bytes = HTML(string=brief_md).write_pdf()
            pdf_key = f"{org_id}/brief_{brief_id}.pdf"

            # Upload PDF to storage
            supa.storage.from_("rmc-briefs").upload(
                pdf_key,
                pdf_bytes,
                file_options={"content-type": "application/pdf", "upsert": True},
            )

            # Update brief record with PDF path
            with engine.begin() as conn:
                conn.execute(
                    text("UPDATE briefs SET pdf_path = :p WHERE id = :id"),
                    {"p": pdf_key, "id": brief_id},
                )

        # Job completed successfully
        supa.table("jobs").update({"status": "done"}).eq("id", job_id).execute()
        return JSONResponse({"ok": True, "job_id": job_id})

    except Exception as exc:
        # Log error, mark job as failed
        print(f"Error processing job {job_id}: {exc}")
        supa.table("jobs").update({"status": "failed", "message": str(exc)}).eq("id", job_id).execute()
        raise HTTPException(status_code=500, detail=f"job processing failed: {exc}")

