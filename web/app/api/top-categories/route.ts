// app/api/top-categories/route.ts
import { NextResponse } from "next/server";
import { getApiContext } from "@/app/lib/api-ctx";

export const dynamic = "force-dynamic";

type Row = {
  category: string | null;
  net_sales: number | null;
  gm_dollar: number | null;
  units: number | null;
};

export async function GET(req: Request) {
  try {
    const context = await getApiContext();
    if ("error" in context) return context.error;
    const { groupId, supabase } = context;

    const url  = new URL(req.url);
    const from = url.searchParams.get("from");
    const to   = url.searchParams.get("to");
    const top  = Math.max(1, Math.min(50, Number(url.searchParams.get("top") ?? 8)));
    const store = url.searchParams.get("store");
    const category = url.searchParams.get("category");
    const sku   = url.searchParams.get("sku");

    // If a specific SKU is selected, compute its category totals from sales data
    if (sku) {
      let qs = supabase.from("sales")
        .select("category, net_sales, gm_dollar, cost, units")
        .eq("group_id", groupId)
        .eq("sku", sku);
      if (store) qs = qs.eq("store_id", store);
      if (category) qs = qs.eq("category", category);
      if (from)  qs = qs.gte("date", from);
      if (to)    qs = qs.lte("date", to);

      const { data: salesData, error: salesErr } = await qs;
      if (salesErr) {
        return NextResponse.json({ error: salesErr.message }, { status: 500 });
      }
      const rows = salesData ?? [];

      // Sum metrics for the SKU's category
      let categoryName: string = "Uncategorized";
      const totals = { rev: 0, gm: 0, units: 0 };
      for (const r of rows) {
        categoryName = r.category ?? "Uncategorized";
        totals.rev   += Number(r.net_sales ?? 0);
        // Compute gm_dollar if not present (net_sales - cost)
        const gm_val = r.gm_dollar !== undefined 
                        ? Number(r.gm_dollar) 
                        : Number(r.net_sales ?? 0) - Number(r.cost ?? 0);
        totals.gm    += gm_val;
        totals.units += Number(r.units ?? 0);
      }
      // If no data (e.g., no sales for that SKU in the period), return empty rows
      if (rows.length === 0) {
        return NextResponse.json({ rows: [] });
      }
      // Prepare one category entry for this SKU's category
      const categoryRow = {
        category: categoryName,
        rev: totals.rev,
        gm: totals.gm,
        units: totals.units,
        gm_pct: totals.rev ? totals.gm / totals.rev : 0
      };
      return NextResponse.json({ rows: [categoryRow] });
    }

    // No specific SKU: aggregate top categories from daily_agg (with optional store filter)
    let q = supabase.from("daily_agg")
      .select("category, net_sales, gm_dollar, units")
      .eq("group_id", groupId);
    if (store) q = q.eq("store_id", store);
    if (category) q = q.eq("category", category);
    if (from)  q = q.gte("date", from);
    if (to)    q = q.lte("date", to);

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const agg: Record<string, { rev: number; gm: number; units: number }> = {};
    for (const r of (data ?? []) as Array<{ category: string | null; net_sales: number | null; gm_dollar: number | null; units: number | null }>) {
      const catKey = r.category ?? "Uncategorized";
      const rev = Number(r.net_sales ?? 0);
      const gm  = Number(r.gm_dollar ?? 0);
      const u   = Number(r.units ?? 0);
      agg[catKey] ??= { rev: 0, gm: 0, units: 0 };
      agg[catKey].rev   += rev;
      agg[catKey].gm    += gm;
      agg[catKey].units += u;
    }
    // Convert aggregated object to sorted array
    const rows = Object.entries(agg).map(([category, vals]) => ({
      category,
      rev: vals.rev,
      gm: vals.gm,
      units: vals.units,
      gm_pct: vals.rev ? vals.gm / vals.rev : 0
    }));
    rows.sort((a, b) => b.rev - a.rev);
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
