import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supaService } from "../../lib/supabase";

export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId, orgId } = auth();
  if (!userId || !orgId) return NextResponse.json({ error: "Auth required" }, { status: 401 });
  const supa = supaService();
  const { data, error } = await supa
    .from("daily_agg")
    .select("category, net_sales, gm_dollar, units")
    .eq("org_id", orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const agg: Record<string, {rev:number,gm:number,units:number}> = {};
  (data||[]).forEach((r:any)=>{
    const k = r.category || 'Uncategorized';
    agg[k] ??= {rev:0, gm:0, units:0};
    agg[k].rev += Number(r.net_sales||0);
    agg[k].gm  += Number(r.gm_dollar||0);
    agg[k].units += Number(r.units||0);
  });
  const rows = Object.entries(agg).map(([category, v])=>({category, ...v, gm_pct: v.rev? v.gm/v.rev : 0}))
    .sort((a,b)=>b.rev - a.rev).slice(0,8);
  return NextResponse.json({ rows });
}
