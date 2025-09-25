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
    const { groupId, supa } = await getApiContext();

    // Optional: ?from=YYYY-MM-DD&to=YYYY-MM-DD&top=8
    const url  = new URL(req.url);
    const from = url.searchParams.get("from");
    const to   = url.searchParams.get("to");
    const top  = Math.max(1, Math.min(50, Number(url.searchParams.get("top") ?? 8)));

    let q = supa
      .from("daily_agg")
      .select("category, net_sales, gm_dollar, units")
      .eq("group_id", groupId);

    if (from) q = q.gte("date", from);
    if (to)   q = q.lte("date", to);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const agg: Record<string, { rev: number; gm: number; units: number }> = {};
    for (const r of (data ?? []) as Row[]) {
      const k = r.category ?? "Uncategorized";
      const rev = Number(r.net_sales  ?? 0);
      const gm  = Number(r.gm_dollar ?? 0);
      const u   = Number(r.units     ?? 0);
      agg[k] ??= { rev: 0, gm: 0, units: 0 };
      agg[k].rev   += rev;
      agg[k].gm    += gm;
      agg[k].units += u;
    }

    const rows = Object.entries(agg)
      .map(([category, v]) => ({
        category,
        rev: v.rev,
        gm: v.gm,
        units: v.units,
        gm_pct: v.rev ? v.gm / v.rev : 0,
      }))
      .sort((a, b) => b.rev - a.rev)
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
