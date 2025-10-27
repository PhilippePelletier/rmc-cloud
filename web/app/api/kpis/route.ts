// app/api/kpis/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { getApiContext } from "@/app/lib/api-ctx";

export const dynamic = "force-dynamic";

type DailyAggRow = {
  date: string;
  net_sales: number | null;
  gm_dollar: number | null;
  units: number | null;
};

export async function GET(req: NextRequest) {
  try {
    const ctx = await getApiContext();
    if ("error" in ctx) return ctx.error;
    const { supabase, groupId } = ctx;

    const url = new URL(req.url);
    let from = url.searchParams.get("from"); // YYYY-MM-DD
    let to   = url.searchParams.get("to");   // YYYY-MM-DD
    const store = url.searchParams.get("store");      // store ID filter (optional)
    const category = url.searchParams.get("category");
    const sku   = url.searchParams.get("sku");        // SKU filter (optional)

    // If date range not provided, default to last 90 days (same as existing logic)
    if (!from || !to) {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 89);
      const y = (d: Date) => d.getFullYear();
      const m = (d: Date) => String(d.getMonth() + 1).padStart(2, "0");
      const dd = (d: Date) => String(d.getDate()).padStart(2, "0");
      if (!from) from = `${y(start)}-${m(start)}-${dd(start)}`;
      if (!to)   to   = `${y(end)}-${m(end)}-${dd(end)}`;
    }

    // **New:** If a specific SKU is requested, query the sales table for that SKU.
    if (sku) {
      let qs = supabase.from("sales")
        .select("date, net_sales, gm_dollar, cost, units")
        .eq("group_id", groupId)
        .eq("sku", sku);
      if (store) qs = qs.eq("store_id", store);
      if (category) qs = qs.eq("category", category);
      if (from)  qs = qs.gte("date", from);
      if (to)    qs = qs.lte("date", to);

      const { data: salesRows, error: salesErr } = await qs;
      if (salesErr) {
        return NextResponse.json({ error: salesErr.message }, { status: 500 });
      }
      const rows = salesRows ?? [];

      // Aggregate the salesRows by date to build a daily trend for this SKU
      const trend: Array<{ date: string; revenue: number }> = [];
      const totals = { revenue: 0, gm_dollar: 0, units: 0 };
      const revenueByDate: Record<string, number> = {};
      const gmByDate: Record<string, number> = {};
      const unitsByDate: Record<string, number> = {};

      for (const r of rows) {
        const d = r.date;
        const rev = Number(r.net_sales ?? 0);
        const gm  = Number(r.gm_dollar ?? (r.net_sales ?? 0) - (r.cost ?? 0));  // gm_dollar might not be stored in sales, compute if needed
        const u   = Number(r.units ?? 0);
        // accumulate totals
        totals.revenue   += rev;
        totals.gm_dollar += gm;
        totals.units     += u;
        // accumulate per date (for trend)
        revenueByDate[d] = (revenueByDate[d] || 0) + rev;
        gmByDate[d]      = (gmByDate[d] || 0) + gm;
        unitsByDate[d]   = (unitsByDate[d] || 0) + u;
      }
      // Build sorted trend array
      const allDates = Object.keys(revenueByDate).sort();
      for (const d of allDates) {
        trend.push({ date: d, revenue: revenueByDate[d] });
      }

      const revenue = totals.revenue;
      const gm_dollar = totals.gm_dollar;
      const units = totals.units;
      const gm_pct = revenue ? gm_dollar / revenue : 0;
      const disc_pct = 0;  // (Discount% can be set to 0 or computed similarly if needed)

      return NextResponse.json({
        revenue,
        gm_dollar,
        gm_pct,
        units,
        disc_pct,
        trend,
        series: trend  // alias for compatibility with front-end
      });
    }

    // **Existing logic for all SKUs (possibly filtered by store):** 
    let q = supabase.from("daily_agg")
      .select("date, net_sales, gm_dollar, units")
      .eq("group_id", groupId);
    if (store) q = q.eq("store_id", store);           // filter by store if provided
    if (category) q = q.eq("category", category);
    if (from)  q = q.gte("date", from);
    if (to)    q = q.lte("date", to);

    const { data, error } = await q.order("date", { ascending: true });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const rows = (data ?? []) as Array<{
      date: string; net_sales: number | null; gm_dollar: number | null; units: number | null;
    }>;

    // Compute aggregate KPIs from the filtered rows
    const revenue   = rows.reduce((sum, r) => sum + Number(r.net_sales ?? 0), 0);
    const gm_dollar = rows.reduce((sum, r) => sum + Number(r.gm_dollar ?? 0), 0);
    const units     = rows.reduce((sum, r) => sum + Number(r.units ?? 0), 0);
    const gm_pct    = revenue ? gm_dollar / revenue : 0;

    // (Optional: Compute disc_pct if needed, similar to original code using sales table)

    // Prepare trend series for revenue over time
    const trend = rows.map(r => ({
      date: r.date,
      revenue: Number(r.net_sales ?? 0),
      gm_dollar: Number(r.gm_dollar ?? 0),
      gm_pct: Number(r.net_sales ?? 0) 
        ? Number(r.gm_dollar ?? 0) / Number(r.net_sales ?? 0) 
        : 0,
      units: Number(r.units ?? 0)
    }));

    return NextResponse.json({
      revenue,
      gm_dollar,
      gm_pct,
      units,
      disc_pct: 0,       // keep 0 or calculate actual discount% if required
      trend,
      series: trend
    });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Unexpected error";
    return NextResponse.json(
      { error: msg },
      { status: /auth required/i.test(msg) ? 401 : 500 }
    );
  }
}
