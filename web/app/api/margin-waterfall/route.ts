// app/api/margin-waterfall/route.ts
import { NextResponse } from "next/server";
import { getApiContext } from "@/app/lib/api-ctx";

export const dynamic = "force-dynamic";

type Row = { net_sales: number | null; gm_dollar: number | null };

export async function GET(req: Request) {
  try {
    const context = await getApiContext();
    if ('error' in context) return context.error;
    const { groupId, supabase } = context;

    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to   = url.searchParams.get("to");
    const store = url.searchParams.get("store");
    const sku   = url.searchParams.get("sku");

    // If a specific SKU is specified, compute revenue and cost from sales for that SKU
    if (sku) {
      let qs = supabase.from("sales")
        .select("net_sales, cost")
        .eq("group_id", groupId)
        .eq("sku", sku);
      if (store) qs = qs.eq("store_id", store);
      if (from)  qs = qs.gte("date", from);
      if (to)    qs = qs.lte("date", to);

      const { data: salesData, error: salesErr } = await qs;
      if (salesErr) {
        return NextResponse.json({ error: salesErr.message }, { status: 500 });
      }
      const salesRows = salesData ?? [];
      const totalRevenue = salesRows.reduce((sum, r: any) => sum + Number(r.net_sales ?? 0), 0);
      const totalCost    = salesRows.reduce((sum, r: any) => sum + Number(r.cost ?? 0), 0);
      const totalGM      = totalRevenue - totalCost;
      return NextResponse.json({
        steps: [
          { name: "Revenue",      value: totalRevenue },
          { name: "Cost",         value: -totalCost },
          { name: "Gross Margin", value: totalGM }
        ]
      });
    }

    // No SKU: use daily_agg for aggregation (with optional store filter)
    let q = supabase.from("daily_agg")
      .select("net_sales, gm_dollar")
      .eq("group_id", groupId);
    if (store) q = q.eq("store_id", store);
    if (from)  q = q.gte("date", from);
    if (to)    q = q.lte("date", to);

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const rows = (data ?? []) as Array<{ net_sales: number | null; gm_dollar: number | null }>;
    const totalRevenue = rows.reduce((acc, r) => acc + Number(r.net_sales ?? 0), 0);
    const totalGM      = rows.reduce((acc, r) => acc + Number(r.gm_dollar ?? 0), 0);
    const totalCost    = totalRevenue - totalGM;
    return NextResponse.json({
      steps: [
        { name: "Revenue",      value: totalRevenue },
        { name: "Cost",         value: -totalCost },
        { name: "Gross Margin", value: totalGM }
      ]
    });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Unexpected error";
    return NextResponse.json(
      { error: msg },
      { status: /auth required/i.test(msg) ? 401 : 500 }
    );
  }
}
