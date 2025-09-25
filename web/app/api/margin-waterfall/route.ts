// app/api/margin-waterfall/route.ts
import { NextResponse } from "next/server";
import { getApiContext } from "@/app/lib/api-ctx";

export const dynamic = "force-dynamic";

type Row = { net_sales: number | null; gm_dollar: number | null };

export async function GET(req: Request) {
  try {
    const { groupId, supa } = await getApiContext();

    // Optional date filters: ?from=YYYY-MM-DD&to=YYYY-MM-DD
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to   = url.searchParams.get("to");

    let q = supa
      .from("daily_agg")
      .select("net_sales, gm_dollar")
      .eq("group_id", groupId);

    if (from) q = q.gte("date", from);
    if (to)   q = q.lte("date", to);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows: Row[] = (data ?? []) as Row[];

    const totalRevenue = rows.reduce((acc, r) => acc + Number(r.net_sales  ?? 0), 0);
    const totalGM      = rows.reduce((acc, r) => acc + Number(r.gm_dollar ?? 0), 0);
    const totalCost    = totalRevenue - totalGM;

    return NextResponse.json({
      steps: [
        { name: "Revenue",      value: totalRevenue },
        { name: "Cost",         value: -totalCost },
        { name: "Gross Margin", value: totalGM },
      ],
    });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Unexpected error";
    return NextResponse.json(
      { error: msg },
      { status: /auth required/i.test(msg) ? 401 : 500 }
    );
  }
}

