// app/api/top-skus/route.ts
import { NextResponse } from "next/server";
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

    // Optional query params: ?from=YYYY-MM-DD&to=YYYY-MM-DD&top=10
    const url  = new URL(req.url);
    const from = url.searchParams.get("from");
    const to   = url.searchParams.get("to");
    const top  = Math.max(1, Math.min(50, Number(url.searchParams.get("top") ?? 10)));

    let q = supabase
      .from("sales")
      .select("sku, net_sales, gm_dollar, units, date")
      .eq("group_id", groupId);

    if (from) q = q.gte("date", from);
    if (to)   q = q.lte("date", to);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Aggregate by SKU
    const agg: Record<string, { revenue: number; gm_dollar: number; units: number }> = {};
    for (const r of (data ?? []) as Row[]) {
      const sku = r.sku ?? "Unknown";
      agg[sku] ??= { revenue: 0, gm_dollar: 0, units: 0 };
      agg[sku].revenue   += Number(r.net_sales  ?? 0);
      agg[sku].gm_dollar += Number(r.gm_dollar ?? 0);
      agg[sku].units     += Number(r.units     ?? 0);
    }

    const rows = Object.entries(agg)
      .map(([sku, v]) => ({
        sku,
        revenue: v.revenue,
        gm_dollar: v.gm_dollar,
        gm_pct: v.revenue ? v.gm_dollar / v.revenue : 0,
        units: v.units,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, top);

    return NextResponse.json({ rows });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Unexpected error";
    return NextResponse.json(
      { error: msg },
      { status: /auth required/i.test(msg) ? 401 : 500 }
    );
  }
}
