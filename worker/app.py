import os
import json
import logging
from datetime import datetime, timedelta
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
import markdown

app = FastAPI(title="RMC Cloud Work")

# -----------------------------------------------------------------------------#
# Config
# -----------------------------------------------------------------------------#
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")  # service role key
SUPABASE_DB_URL = os.getenv("SUPABASE_DB_URL")         # direct Postgres URL
SECRET = os.getenv("WORKER_SHARED_SECRET", "")
UPLOADS_BUCKET = os.getenv("SUPABASE_UPLOADS_BUCKET", "rmc-uploads")
BRIEFS_BUCKET  = os.getenv("SUPABASE_BRIEFS_BUCKET",  "rmc-briefs")


OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if OPENAI_API_KEY:
    openai.api_key = OPENAI_API_KEY

logging.basicConfig(level=logging.INFO)

# Supabase service client (for DB and Storage operations)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Direct Postgres engine for bulk upserts/queries
engine = create_engine(SUPABASE_DB_URL, future=True)

# -----------------------------------------------------------------------------#
# Brief template (Markdown)
# -----------------------------------------------------------------------------#
BRIEF_MD_TEMPLATE = Template(
    """
# Weekly Brief — {{ week }}

## Executive Summary
{{ narrative }}

## KPIs
- **Revenue:** ${{ revenue|round(0)|int }}
- **Gross Margin ($):** ${{ gm_dollar|round(0)|int }}
- **Gross Margin (%):** {{ (gm_pct * 100)|round(1) }}%
- **Units Sold:** {{ units|round(0)|int }}

## Top Categories
{% for row in top_categories -%}
- **{{ row.category }}:** ${{ row.revenue|round(0)|int }} (GM%: {{ (row.gm_pct * 100)|round(1) }}%)
{% endfor %}

## Anomalies
{% if anomalies %}
{% for a in anomalies -%}
- On {{ a.date }}, **{{ a.category }}** revenue was {{ a.delta_pct|round(1) }}% off the mean (revenue: ${{ a.revenue|round(0)|int }})
{% endfor %}
{% else %}
No anomalies detected this week.
{% endif %}
""".lstrip()
)

# CSS styles for PDF rendering
PDF_CSS = """
body { font-family: Arial, sans-serif; font-size: 12px; color: #000; }
h1 { font-size: 1.4em; margin-bottom: 0.5em; }
h2 { font-size: 1.2em; margin-top: 1em; margin-bottom: 0.5em; }
ul { margin-left: 1.5em; margin-bottom: 1em; }
li { margin-bottom: 0.25em; }
"""

# -----------------------------------------------------------------------------#
# Helpers
# -----------------------------------------------------------------------------#
def aggregate(group_id: str) -> Optional[Tuple[pd.DataFrame, pd.DataFrame]]:
    """
    Read raw sales data for this workspace (group_id) and compute daily aggregates.
    Returns a tuple of (raw_df, daily_df) or None if no data.
    """
    with engine.begin() as conn:
        df = pd.read_sql(
            text("""
                SELECT date, store_id, category, units, net_sales, cost
                FROM sales
                WHERE group_id = :g
            """),
            conn,
            params={"g": group_id},
        )
    if df.empty:
        return None

    df["gm_dollar"] = df["net_sales"] - df["cost"]

    # Aggregate daily totals per store-category
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


def upsert_table(conn, group_id: str, org_id: Optional[str], df: pd.DataFrame, table: str) -> None:
    """
    Insert DataFrame into the target table with the given group_id and org_id.
    Uses upsert for the 'sales' table to avoid duplicate entries.
    """
    out = df.copy()
    out["group_id"] = group_id
    out["org_id"] = org_id  # org_id can be None
    if table == "sales":
        # Bulk upsert for sales: ignore duplicates on (group_id, date, store_id, sku)
        records = out.to_dict(orient="records")
        conn.execute(text("""
            INSERT INTO sales (
                date, store_id, sku, product_name, units, net_sales, discount, cost, category, sub_category, group_id, org_id
            ) VALUES (
                :date, :store_id, :sku, :product_name, :units, :net_sales, :discount, :cost, :category, :sub_category, :group_id, :org_id
            )
            ON CONFLICT (group_id, date, store_id, sku) DO NOTHING
        """), records)
    else:
        out.to_sql(table, conn, if_exists="append", index=False)


def compute_metrics(raw: pd.DataFrame, daily: pd.DataFrame) -> Dict[str, Any]:
    revenue = float(daily["net_sales"].sum())
    gm_dollar = float(daily["gm_dollar"].sum())
    gm_pct = (gm_dollar / revenue) if revenue else 0.0
    units = float(daily["units"].sum())

    # Top categories (top 5 by revenue)
    cats = (
        daily.groupby("category", dropna=False)
        .agg(revenue=("net_sales", "sum"), gm=("gm_dollar", "sum"), units=("units", "sum"))
        .reset_index()
    )
    cats["category"] = cats["category"].fillna("Uncategorized")
    cats["gm_pct"] = cats["gm"] / cats["revenue"].replace({0: 1})
    top_categories = (
        cats.sort_values("revenue", ascending=False)
        .head(5)
        .rename(columns={"gm": "gm_dollar"})
        .to_dict(orient="records")
    )

    # Simple anomaly detection (2σ) on recent data (~last 90 days per category)
    anomalies: List[Dict[str, Any]] = []
    daily["date"] = pd.to_datetime(daily["date"])
    cutoff_date = pd.Timestamp.now() - pd.Timedelta(days=90)
    recent_daily = daily[daily["date"] >= cutoff_date]
    for cat, group in recent_daily.groupby("category", dropna=False):
        cat_name = cat if pd.notna(cat) else "Uncategorized"
        vals = group["net_sales"].astype(float)
        mean = vals.mean()
        std = vals.std(ddof=0) or 1e-9
        for date, revenue_val in zip(group["date"], vals):
            if abs(revenue_val - mean) > 2 * std:
                anomalies.append({
                    "date": str(date),
                    "category": cat_name,
                    "revenue": float(revenue_val),
                    "delta_pct": float(((revenue_val - mean) / mean) * 100) if mean else 0.0
                })  # Note: If mean is 0, delta_pct is set to 0.

    return {
        "revenue": revenue,
        "gm_dollar": gm_dollar,
        "gm_pct": gm_pct,
        "units": units,
        "top_categories": top_categories,
        "anomalies": anomalies,
    }


def generate_ai_narrative(metrics: Dict[str, Any]) -> str:
    if not openai.api_key:
        return "AI narrative is unavailable (no API key configured)."
    prompt = f"""
You are an AI assistant who creates a weekly business brief for a small retailer.
Below are the aggregated metrics for the week. Please:
1) Summarize the overall performance (revenue, gross margin, units).
2) Highlight top and bottom categories and significant changes.
3) Explain detected anomalies and why they matter.
4) Suggest up to three actionable steps for next week.

Use ONLY the numbers provided.

Metrics:
{json.dumps(metrics, indent=2)}
""".strip()

    try:
        resp = openai.ChatCompletion.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a concise, helpful business analyst."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            max_tokens=800,
        )
        return resp.choices[0].message["content"].strip()
    except Exception as e:
        logging.error(f"AI generation failed: {e}")
        return "AI narrative could not be generated this week due to an internal error."


def download_csv(bucket: str, path: str) -> pd.DataFrame:
    # Download a CSV file from Supabase Storage and return it as a pandas DataFrame
    res: bytes = supabase.storage.from_(bucket).download(path)
    return pd.read_csv(StringIO(res.decode("utf-8")))

# -----------------------------------------------------------------------------#
# Job processor endpoint
# -----------------------------------------------------------------------------#
@app.post("/jobs/process")
async def process(req: Request):
    # 0) Authenticate request using shared secret (unchanged)
    if req.headers.get("x-rmc-secret", "") != SECRET:
        raise HTTPException(status_code=401, detail="unauthorized")

    payload = await req.json()
    job_id = str(payload.get("job_id") or "").strip()
    # NEW: get mapping from payload if present
    mapping = payload.get("mapping")

    if not job_id:
        raise HTTPException(status_code=400, detail="missing or invalid job_id")

    # 1) Retrieve job record (contains group_id and optional org_id) - unchanged
    job = supabase.table("jobs").select("*").eq("id", job_id).single().execute().data
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    group_id: str = job.get("group_id") or job.get("org_id")
    org_id: Optional[str] = job.get("org_id")
    kind: str = job["kind"]
    path: str = job["path"]
    if not group_id:
        raise HTTPException(status_code=400, detail="job missing group_id")

    # 2) Mark job as running (unchanged)
    supabase.table("jobs").update({"status": "running"}).eq("id", job_id).execute()

    try:
        logging.info(f"Started processing job {job_id} (kind='{kind}', group_id='{group_id}')")

        # 3) Load the uploaded CSV from storage
        df = download_csv(UPLOADS_BUCKET, path)


        # 3.5) Apply field mapping if provided
        if mapping:
            if not isinstance(mapping, dict):
                raise ValueError("Invalid mapping format")
            # Rename DataFrame columns: map actual CSV column name -> expected name
            for required_field, actual_col in mapping.items():
                if actual_col not in df.columns:
                    # If a mapped column is missing in CSV, abort with error
                    raise ValueError(f"Mapping error: column '{actual_col}' for field '{required_field}' not found in CSV")
            df = df.rename(columns={actual: req for req, actual in mapping.items()})

        # 4) Process CSV data into the appropriate table(s)
        with engine.begin() as conn:
            if kind == "sales":
                required_cols = ["date", "store_id", "sku", "product_name", "units", "net_sales", "discount", "cost", "category", "sub_category"]
                missing = [c for c in required_cols if c not in df.columns]
                if missing:
                    # If any required columns are missing after mapping, throw error
                    raise ValueError(f"sales CSV missing columns: {missing}")
                df = df[required_cols]
                # Validate types...
                df["date"] = pd.to_datetime(df["date"], errors="raise")
                for col in ["units", "net_sales", "discount", "cost"]:
                    df[col] = pd.to_numeric(df[col], errors="raise")
                upsert_table(conn, group_id, org_id, df, "sales")
            elif kind == "product_master":
                required_cols = ["sku", "product_name", "category", "sub_category", "default_cost", "status"]
                missing = [c for c in required_cols if c not in df.columns]
                if missing:
                    raise ValueError(f"product_master CSV missing columns: {missing}")
                df = df[required_cols]
                df["default_cost"] = pd.to_numeric(df["default_cost"], errors="raise")
                df["status"] = df["status"].astype(str)
                upsert_table(conn, group_id, org_id, df, "products")
            elif kind == "store_master":
                required_cols = ["store_id", "store_name", "region", "city", "currency", "is_active"]
                missing = [c for c in required_cols if c not in df.columns]
                if missing:
                    raise ValueError(f"store_master CSV missing columns: {missing}")
                df = df[required_cols]
                # Normalize is_active to boolean...
                # (rest of processing unchanged)
                ...
            elif kind == "promo_calendar":
                required_cols = ["start_date", "end_date", "promo_name", "sku", "promo_type", "discount_pct"]
                missing = [c for c in required_cols if c not in df.columns]
                if missing:
                    raise ValueError(f"promo_calendar CSV missing columns: {missing}")
                df = df[required_cols]
                df["start_date"] = pd.to_datetime(df["start_date"], errors="raise")
                df["end_date"] = pd.to_datetime(df["end_date"], errors="raise")
                if (df["end_date"] < df["start_date"]).any():
                    raise ValueError("promo_calendar CSV has end_date earlier than start_date")
                df["discount_pct"] = pd.to_numeric(df["discount_pct"], errors="raise")
                if (df["discount_pct"] < 0).any() or (df["discount_pct"] > 100).any():
                    raise ValueError("promo_calendar CSV has discount_pct outside 0-100 range")
                upsert_table(conn, group_id, org_id, df, "promos")
            else:
                raise ValueError(f"Unsupported CSV kind: {kind}")

        # 5) Recompute aggregates for this workspace
        agg_result = aggregate(group_id)
        if agg_result:
            raw, daily = agg_result
            with engine.begin() as conn:
                # Clear previous daily aggregates for this workspace
                conn.execute(text("DELETE FROM daily_agg WHERE group_id = :g"), {"g": group_id})
                daily["group_id"] = group_id
                daily["org_id"] = org_id
                daily.to_sql("daily_agg", conn, if_exists="append", index=False)

            # 6) Compute metrics and generate AI narrative
            metrics = compute_metrics(raw, daily)
            narrative = generate_ai_narrative(metrics)

            # 7) Render weekly brief Markdown content
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

            # 8) Insert the brief record into the database
            with engine.begin() as conn:
                result = conn.execute(
                    text("INSERT INTO briefs (group_id, org_id, content_md) VALUES (:g, :o, :m) RETURNING id"),
                    {"g": group_id, "o": org_id, "m": brief_md},
                ).first()
                brief_id = result[0]

            # 9) Convert Markdown to PDF and upload to storage
            brief_html = markdown.markdown(brief_md)
            full_html = f"<html><head><style>{PDF_CSS}</style></head><body>{brief_html}</body></html>"
            pdf_bytes = HTML(string=full_html).write_pdf()
            pdf_key = f"{group_id}/brief_{brief_id}.pdf"
            supabase.storage.from_(BRIEFS_BUCKET).upload(
                pdf_key,
                pdf_bytes,
                file_options={"content-type": "application/pdf", "upsert": True},
            )

            )

            # 10) Update the brief record with the PDF path
            with engine.begin() as conn:
                conn.execute(
                    text("UPDATE briefs SET pdf_path = :p WHERE id = :id"),
                    {"p": pdf_key, "id": brief_id},
                )

        # 11) Mark job as done
        supabase.table("jobs").update({"status": "done"}).eq("id", job_id).execute()
        logging.info(f"Job {job_id} completed successfully")
        try:
            return JSONResponse({"ok": True, "job_id": job_id})

            except Exception as exc:
                logging.exception(f"Error processing job {job_id}")
                supabase.table("jobs").update({"status": "failed", "message": str(exc)}).eq("id", job_id).execute()
                raise HTTPException(status_code=500, detail=f"job processing failed: {exc}")


@app.get("/health")
async def health():
    return {"status": "ok"}

