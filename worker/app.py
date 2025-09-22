import os
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from supabase import create_client, Client
from sqlalchemy import create_engine, text
import pandas as pd
from io import StringIO, BytesIO
from jinja2 import Template
from weasyprint import HTML
from datetime import datetime

app = FastAPI(title="RMC Cloud Worker")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SUPABASE_DB_URL = os.environ["SUPABASE_DB_URL"]
SECRET = os.environ.get("WORKER_SHARED_SECRET","")

supa: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
engine = create_engine(SUPABASE_DB_URL, future=True)

BRIEF_TEMPLATE = Template("""# Weekly Brief — {{ week }}
**KPIs**: Revenue ${{ rev|round(0)|int }}, GM% {{ (gm/rev*100 if rev else 0)|round(1) }}%, Units {{ units|int }}

## Actions
- Raise price +2% on SKU-001
- Audit discounts in Tools
- Rebalance assortment in Fasteners
""")

def aggregate(org_id):
    with engine.begin() as conn:
        df = pd.read_sql(text("select date, store_id, category, units, net_sales, cost from sales where org_id=:o"), conn, params={'o':org_id})
    if df.empty:
        return None
    df['gm_dollar'] = df['net_sales'] - df['cost']
    daily = df.groupby(['date','store_id','category'], as_index=False).agg(units=('units','sum'), net_sales=('net_sales','sum'), gm_dollar=('gm_dollar','sum'))
    daily['gm_pct'] = (daily['gm_dollar']/daily['net_sales']).fillna(0)
    return df, daily

def upsert_table(conn, org_id, df, table):
    df = df.copy()
    df['org_id'] = org_id
    df.to_sql(table, conn, if_exists='append', index=False)

@app.post("/jobs/process")
async def process(req: Request):
    if req.headers.get("x-rmc-secret","") != SECRET:
        raise HTTPException(401, "unauthorized")
    payload = await req.json()
    job_id = int(payload['job_id'])
    # fetch job
    job = supa.table('jobs').select('*').eq('id', job_id).single().execute().data
    if not job:
        raise HTTPException(404, "job not found")

    org_id = job['org_id']; kind = job['kind']; path = job['path']
    supa.table('jobs').update({'status':'running'}).eq('id', job_id).execute()

    # download CSV from storage
    res = supa.storage.from_('rmc-uploads').download(path)
    csv_bytes = res
    df = pd.read_csv(StringIO(csv_bytes.decode('utf-8')))

    # persist raw by kind
    with engine.begin() as conn:
        if kind == 'sales':
            cols = ['date','store_id','sku','product_name','units','net_sales','discount','cost','category','sub_category']
            df = df[cols]
            upsert_table(conn, org_id, df, 'sales')
        elif kind == 'product_master':
            upsert_table(conn, org_id, df, 'products')
        elif kind == 'store_master':
            upsert_table(conn, org_id, df, 'stores')
        elif kind == 'promo_calendar':
            upsert_table(conn, org_id, df, 'promos')
        else:
            raise HTTPException(400, "invalid kind")

        # recompute aggregates + brief
        agg = aggregate(org_id)
        if agg:
            raw, daily = agg
            conn.execute(text("delete from daily_agg where org_id=:o"), {'o':org_id})
            daily['org_id'] = org_id
            daily.to_sql('daily_agg', conn, if_exists='append', index=False)

            rev = float(daily['net_sales'].sum())
            gm = float(daily['gm_dollar'].sum())
            units = float(daily['units'].sum())
            md = BRIEF_TEMPLATE.render(week=datetime.utcnow().date().isoformat(), rev=rev, gm=gm, units=units)

            # save brief record
            r = conn.execute(text("insert into briefs(org_id, content_md) values(:o, :m) returning id"), {'o':org_id, 'm':md}).first()
            brief_id = r[0]

            # render + upload PDF
            pdf = HTML(string=f"<html><body>{md}</body></html>").write_pdf()
            pdf_key = f"{org_id}/brief_{brief_id}.pdf"
            supa.storage.from_('rmc-briefs').upload(pdf_key, pdf, file_options={'content-type':'application/pdf', 'upsert':True})
            conn.execute(text("update briefs set pdf_path=:p where id=:id"), {'p':pdf_key, 'id':brief_id})

    supa.table('jobs').update({'status':'done'}).eq('id', job_id).execute()
    return JSONResponse({'ok': True, 'job_id': job_id})
