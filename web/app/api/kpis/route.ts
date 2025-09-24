// web/app/api/kpis/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supaService } from "../../lib/supabase";

export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId, orgId } = auth();
  if (!userId) {
    return NextResponse.json({ error: 'Auth required' }, { status: 401 });
  }
  
  // Use the organization if present, otherwise fall back to the user ID.
  const groupId = orgId ?? userId;
  
  const supa = supaService();

  const { data: daily, error } = await supa
    .from("daily_agg")
    .select("date, net_sales, gm_dollar, units")
    .eq("org_id", orgId)
    .order("date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const revenue    = daily?.reduce((a, r) => a + Number(r.net_sales || 0), 0) || 0;
  const gm_dollar  = daily?.reduce((a, r) => a + Number(r.gm_dollar || 0), 0) || 0;
  const units      = daily?.reduce((a, r) => a + Number(r.units || 0), 0) || 0;
  const disc_pct   = 0; // TODO: compute if discount data available

  // Build trend array using net_sales
  const trend = (daily || []).map((r) => ({
    date: r.date,
    revenue: Number(r.net_sales || 0),
  }));

  return NextResponse.json({
    revenue,
    gm_dollar,
    gm_pct: revenue ? gm_dollar / revenue : 0,
    units,
    disc_pct,
    trend,
  });
}
