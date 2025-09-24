# worker/app.py
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

app = FastAPI(title="RMC Cloud Worker")

# -----------------------------------------------------------------------------#
# Config
# -----------------------------------------------------------------------------#
SUPABASE_URL   = os.getenv("SUPABASE_URL")
SUPABASE_KEY   = os.getenv("SUPABASE_SERVICE_ROLE_KEY")  # service role key
SUPABASE_DB_URL = os.getenv("SUPABASE_DB_URL")           # direct Postgres URL
SECRET         = os.getenv("WORKER_SHARED_SECRET", "")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if OPENAI_API_KEY:
    openai.api_key = OPENAI_API_KEY

# Supabase service client (Storage + REST)
supa: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Direct Postgres for bulk upserts/queries
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
""".lstrip()
)

# -----------------------------------------------------------------------------#
# Helpers
# -----------------------------------------------------------------------------#
def aggregate(group_id: str) -> Optional[Tuple[pd.DataFrame, pd.DataFrame]]:
    """
    Read raw sales data for this workspace (group_id) and compute daily aggregates.
    group_id is ALWAYS present (userId or org UUID).
    """
    with engine.begin() as conn:
        df = pd.read_sql(
            text(
                """
                SELECT date, store_id, category, units, net_sales, cost
                FROM sales
                WHERE group_id = :g
                """
            ),
            conn,
            params={"g": group_id},
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


def upsert_table(conn, group_id: str, org_id: Optional[str], df: pd.DataFrame, table: str) -> None:
    """
    Append DataFrame into target table, adding group_id (always) and org_id (nullable).
    """
    out = df.copy()
    out["group_id"] = group_id
    out["org_id"]   = org_id  # can be None
    out.to_sql(table, conn, if_exists="append", index=False)


def compute_metrics(raw: pd.DataFrame, daily: pd.DataFrame) -> Dict[str, Any]:
    revenue   = float(daily["net_sales"].sum())
    gm_dollar = float(daily["gm_dollar"].sum())
    gm_pct    = (gm_dollar / revenue) if revenue else 0.0
    units     = float(daily["units"].sum())

    # Top categories
    cats = (
        daily.groupby("category", dropna=False)
        .agg(revenue=("net_sales", "sum"), gm=("gm_dollar", "sum"), units=("units", "sum"))
        .reset_index()
    )
    cats["category"] = cats["category"].fillna("Uncategorized")
    cats["gm_pct"]   = cats["gm"] / cats["revenue"].replace({0: 1})
    top_categories = (
        cats.sort_values("revenue", ascending=False)
        .head(5)
        .rename(columns={"gm": "gm_dollar"})
        .to_dict(orient="records")
    )

    # Simple anomaly detection (2σ rule per category)
    anomalies: List[Dict[str, Any]] = []
    for cat, group in daily.groupby("category", dropna=False):
        cat_name = cat if pd.notna(cat) else "Uncategorized"
        vals = group["net_sales"].astype(float)
        mean = vals.mean()
        std  = vals.std(ddof=0) or 1e-9
        for date, revenue_val in zip(group["date"], vals):
            if abs(revenue_val - mean) > 2 * std:
                delta_pct = (revenue_val - mean) / mean * 100 if mean else 0
                anomalies.append({
                    "date": str(date),
                    "category": cat_name,
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
    if not openai.api_key:
        return "AI narrative is unavailable (no API key configured)."
    prompt = f"""
You are an AI assistant who creates a weekly business brief for a small retailer.
Below are the aggregated metrics for the week. Please:
1) Summarise the overall performance (revenue, gross margin, units).
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
        print(f"AI generation failed: {e}")
        return "AI narrative could not be generated this week due to an internal error."


def download_csv(bucket: str, path: str) -> pd.DataFrame:
    res: bytes = supa.storage.from_(bucket).download(path)
    return pd.read_csv(StringIO(res.decode("utf-8")))

# -----------------------------------------------------------------------------#
# Job processor
# -----------------------------------------------------------------------------#
@app.post("/jobs/process")
async def process(req: Request):
    # 0) Auth (shared secret from web)
    if req.headers.get("x-rmc-secret", "") != SECRET:
        raise HTTPException(status_code=401, detail="unauthorized")

    payload = await req.json()
    job_id = int(payload.get("job_id", 0))
    if not job_id:
        raise HTTPException(status_code=400, detail="missing job_id")

    # 1) Load job (now expects group_id always; org_id may be null)
    job = (
        supa.table("jobs")
        .select("*")
        .eq("id", job_id)
        .single()
        .execute()
        .data
    )
    if not job:
        raise HTTPException(status_code=404, detail="job not found")

    # Workspace identifiers
    group_id: str           = job.get("group_id") or job.get("org_id")  # backward compat
    org_id: Optional[str]   = job.get("org_id")  # may be None in personal workspace
    kind: str               = job["kind"]
    path: str               = job["path"]

    if not group_id:
        raise HTTPException(status_code=400, detail="job missing group_id")

    # 2) Mark RUNNING
    supa.table("jobs").update({"status": "running"}).eq("id", job_id).execute()

    try:
        # 3) Download CSV
        df = download_csv("rmc-uploads", path)

        # 4) Ingest CSV into business tables with group_id (+ org_id if present)
        with engine.begin() as conn:
            if kind == "sales":
                required_cols = [
                    "date", "store_id", "sku", "product_name",
                    "units", "net_sales", "discount", "cost",
                    "category", "sub_category"
                ]
                # Keep only expected columns (raise if missing)
                missing = [c for c in required_cols if c not in df.columns]
                if missing:
                    raise ValueError(f"sales CSV missing columns: {missing}")
                df = df[required_cols]
                upsert_table(conn, group_id, org_id, df, "sales")

            elif kind == "product_master":
                upsert_table(conn, group_id, org_id, df, "products")

            elif kind == "store_master":
                upsert_table(conn, group_id, org_id, df, "stores")

            elif kind == "promo_calendar":
                upsert_table(conn, group_id, org_id, df, "promos")

            else:
                raise ValueError(f"Unsupported CSV kind: {kind}")

        # 5) Recompute aggregates for THIS group_id
        agg = aggregate(group_id)
        if agg:
            raw, daily = agg
            with engine.begin() as conn:
                # Clear old rows for this workspace
                conn.execute(text("DELETE FROM daily_agg WHERE group_id = :g"), {"g": group_id})
                daily["group_id"] = group_id
                daily["org_id"]   = org_id
                daily.to_sql("daily_agg", conn, if_exists="append", index=False)

            # 6) KPIs + AI narrative
            metrics   = compute_metrics(raw, daily)
            narrative = generate_ai_narrative(metrics)

            # 7) Render Markdown brief
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

            # 8) Save brief row (group_id always; org_id optional)
            with engine.begin() as conn:
                r = conn.execute(
                    text(
                        "INSERT INTO briefs (group_id, org_id, content_md) "
                        "VALUES (:g, :o, :m) RETURNING id"
                    ),
                    {"g": group_id, "o": org_id, "m": brief_md},
                ).first()
                brief_id = r[0]

            # 9) PDF → Storage (namespaced by group_id)
            pdf_bytes = HTML(string=brief_md).write_pdf()
            pdf_key = f"{group_id}/brief_{brief_id}.pdf"

            supa.storage.from_("rmc-briefs").upload(
                pdf_key,
                pdf_bytes,
                file_options={"content-type": "application/pdf", "upsert": True},
            )

            # 10) Update brief record with storage path
            with engine.begin() as conn:
                conn.execute(
                    text("UPDATE briefs SET pdf_path = :p WHERE id = :id"),
                    {"p": pdf_key, "id": brief_id},
                )

        # 11) Done
        supa.table("jobs").update({"status": "done"}).eq("id", job_id).execute()
        return JSONResponse({"ok": True, "job_id": job_id})

    except Exception as exc:
        print(f"Error processing job {job_id}: {exc}")
        supa.table("jobs").update({"status": "failed", "message": str(exc)}).eq("id", job_id).execute()
        raise HTTPException(status_code=500, detail=f"job processing failed: {exc}")
