import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { supaService } from "../../lib/supabase";

export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId, orgId } = auth();
  if (!userId || !orgId) return NextResponse.json({ error: "Auth required" }, { status: 401 });
  const supa = supaService();

  const { data: daily, error } = await supa
    .from("daily_agg")
    .select("date, net_sales, gm_dollar, units")
    .eq("org_id", orgId)
    .order("date", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rev = daily?.reduce((a:any,r:any)=>a + Number(r.net_sales||0), 0) || 0;
  const gm = daily?.reduce((a:any,r:any)=>a + Number(r.gm_dollar||0), 0) || 0;
  const units = daily?.reduce((a:any,r:any)=>a + Number(r.units||0), 0) || 0;
  const disc_pct = 0;

  const trend = (daily||[]).map((r:any)=>({ date: r.date, net_sales: Number(r.net_sales||0) }));
  return NextResponse.json({ kpis: { rev, gm_pct: rev? gm/rev : 0, units, disc_pct }, trend });
}
