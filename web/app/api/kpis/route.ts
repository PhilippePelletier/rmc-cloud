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

    // Optional: sensible default window (last 90 days) if not provided
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

    // Pull daily aggregates
    let q = supabase
      .from("daily_agg")
      .select("date, net_sales, gm_dollar, units")
      .eq("group_id", groupId);

    if (from) q = q.gte("date", from);
    if (to)   q = q.lte("date", to);

    const { data, error } = await q.order("date", { ascending: true });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const rows: DailyAggRow[] = (data ?? []) as DailyAggRow[];

    const revenue   = rows.reduce((a, r) => a + Number(r.net_sales  ?? 0), 0);
    const gm_dollar = rows.reduce((a, r) => a + Number(r.gm_dollar ?? 0), 0);
    const units     = rows.reduce((a, r) => a + Number(r.units     ?? 0), 0);

    // Optional: compute discount% from the sales table if you track `discount`
    // Comment this block out if you prefer disc_pct: 0
    let disc_pct = 0;
    {
      let qs = supabase
        .from("sales")
        .select("net_sales, discount")
        .eq("group_id", groupId);
      if (from) qs = qs.gte("date", from);
      if (to)   qs = qs.lte("date", to);

      const { data: salesRows, error: salesErr } = await qs.limit(50000); // safety cap
      if (!salesErr && salesRows) {
        const disc = salesRows.reduce((a, r: any) => a + Number(r.discount ?? 0), 0);
        const ns   = salesRows.reduce((a, r: any) => a + Number(r.net_sales ?? 0), 0);
        disc_pct = ns > 0 ? disc / ns : 0;
      }
    }

    const trend = rows.map(r => ({
      date: r.date,
      revenue: Number(r.net_sales ?? 0),
    }));

    return NextResponse.json({
      revenue,
      gm_dollar,
      gm_pct: revenue ? gm_dollar / revenue : 0,
      units,
      disc_pct,          // set to 0 if you don't want the extra sales query
      trend,
      series: trend,     // legacy alias your charts use
    });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Unexpected error";
    return NextResponse.json(
      { error: msg },
      { status: /auth required/i.test(msg) ? 401 : 500 }
    );
  }
}
