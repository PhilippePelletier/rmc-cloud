// app/api/kpis/route.ts
import { NextResponse } from "next/server";
import { getApiContext } from "@/app/lib/api-ctx";

export const dynamic = "force-dynamic";

type DailyAggRow = {
  date: string;
  net_sales: number | null;
  gm_dollar: number | null;
  units: number | null;
};

export async function GET(req: Request) {
  try {
    const { groupId, supa } = await getApiContext();

    // Optional filters: ?from=YYYY-MM-DD&to=YYYY-MM-DD
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to   = url.searchParams.get("to");

    let q = supa
      .from("daily_agg")
      .select("date, net_sales, gm_dollar, units")
      .eq("group_id", groupId);

    if (from) q = q.gte("date", from);
    if (to)   q = q.lte("date", to);

    const { data, error } = await q.order("date", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows: DailyAggRow[] = (data ?? []) as DailyAggRow[];

    const revenue   = rows.reduce((a, r) => a + Number(r.net_sales  ?? 0), 0);
    const gm_dollar = rows.reduce((a, r) => a + Number(r.gm_dollar ?? 0), 0);
    const units     = rows.reduce((a, r) => a + Number(r.units     ?? 0), 0);

    const trend = rows.map(r => ({ date: r.date, revenue: Number(r.net_sales ?? 0) }));

    return NextResponse.json({
      revenue,
      gm_dollar,
      gm_pct: revenue ? gm_dollar / revenue : 0,
      units,
      disc_pct: 0,
      trend,
      series: trend, // legacy alias for your dashboard
    });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: /auth required/i.test(msg) ? 401 : 500 });
  }
}
