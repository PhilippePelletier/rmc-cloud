// app/api/top-skus/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { getApiContext } from "@/app/lib/api-ctx";

export const dynamic = "force-dynamic";

type Row = {
  sku: string | null;
  net_sales: number | null;
  gm_dollar: number | null;
  units: number | null;
  date?: string | null; // only used if you pass from/to
};

export async function GET(req: Request) {
  try {
    const context = await getApiContext();
    if ('error' in context) return context.error;
    const { groupId, supabase } = context;

    const url  = new URL(req.url);
    const from = url.searchParams.get("from");
    const to   = url.searchParams.get("to");
    const top  = Math.max(1, Math.min(50, Number(url.searchParams.get("top") ?? 10)));
    const store = url.searchParams.get("store");
    const sku   = url.searchParams.get("sku");

    let q = supabase.from("sales")
      .select("sku, net_sales, gm_dollar, cost, units, date")
      .eq("group_id", groupId);
    if (store) q = q.eq("store_id", store);
    if (sku)   q = q.eq("sku", sku);
    if (from)  q = q.gte("date", from);
    if (to)    q = q.lte("date", to);

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Aggregate by SKU
    const agg: Record<string, { revenue: number; gm_dollar: number; units: number }> = {};
    for (const r of (data ?? []) as Array<{ sku: string | null; net_sales: number | null; gm_dollar?: number | null; cost?: number | null; units: number | null }>) {
      const skuKey = r.sku ?? "Unknown";
      // Compute gm_dollar if not present (for consistency; in sales data, we might calculate it)
      const gmVal = r.gm_dollar !== undefined 
                     ? Number(r.gm_dollar) 
                     : Number(r.net_sales ?? 0) - Number(r.cost ?? 0);
      agg[skuKey] ??= { revenue: 0, gm_dollar: 0, units: 0 };
      agg[skuKey].revenue   += Number(r.net_sales ?? 0);
      agg[skuKey].gm_dollar += gmVal;
      agg[skuKey].units     += Number(r.units ?? 0);
    }

    const rows = Object.entries(agg).map(([sku, vals]) => ({
      sku,
      revenue: vals.revenue,
      gm_dollar: vals.gm_dollar,
      gm_pct: vals.revenue ? vals.gm_dollar / vals.revenue : 0,
      units: vals.units,
    }));
    rows.sort((a, b) => b.revenue - a.revenue);
    const topRows = rows.slice(0, top);
    return NextResponse.json({ rows: topRows });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Unexpected error";
    return NextResponse.json(
      { error: msg },
      { status: /auth required/i.test(msg) ? 401 : 500 }
    );
  }
}
