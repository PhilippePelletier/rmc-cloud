// web/app/api/kpis/route.ts
import { NextResponse } from "next/server";
import { supaRls } from "@/app/lib/supabase-rls";     // RLS client using Clerk JWT template "supabase"
import { getCurrentGroupId } from "@/app/lib/group";  // returns org UUID string if org selected, else userId

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1) Resolve current workspace (org uuid string OR user id)
    const groupId = await getCurrentGroupId();

    // 2) Use RLS-enforced client
    const supa = await supaRls();

    // 3) Filter by group_id (TEXT), never org_id
    const { data: daily, error } = await supa
      .from("daily_agg")
      .select("date, net_sales, gm_dollar, units")
      .eq("group_id", groupId)
      .order("date", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = daily ?? [];

    // 4) Aggregate KPIs
    const revenue   = rows.reduce((a, r) => a + Number(r.net_sales ?? 0), 0);
    const gm_dollar = rows.reduce((a, r) => a + Number(r.gm_dollar ?? 0), 0);
    const units     = rows.reduce((a, r) => a + Number(r.units ?? 0), 0);
    const disc_pct  = 0; // TODO: compute if you track discounts separately

    // 5) Build time series (net_sales)
    const trend = rows.map((r) => ({
      date: r.date as string,
      revenue: Number(r.net_sales ?? 0),
    }));

    // NOTE: return `series` as an alias for backward-compat with your early dashboard code
    return NextResponse.json({
      revenue,
      gm_dollar,
      gm_pct: revenue ? gm_dollar / revenue : 0,
      units,
      disc_pct,
      trend,
      series: trend, // <- legacy alias; safe to keep
    });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Unexpected error";
    return NextResponse.json(
      { error: msg },
      { status: /auth required/i.test(msg) ? 401 : 500 }
    );
  }
}
