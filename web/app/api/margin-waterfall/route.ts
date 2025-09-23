// web/app/api/margin-waterfall/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supaService } from "../../lib/supabase";

export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId, orgId } = auth();
  if (!userId || !orgId)
    return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const supa = supaService();
  const { data, error } = await supa
    .from("daily_agg")
    .select("net_sales, gm_dollar")
    .eq("org_id", orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const totalRevenue = data?.reduce((acc, r) => acc + Number(r.net_sales || 0), 0) || 0;
  const totalGM      = data?.reduce((acc, r) => acc + Number(r.gm_dollar || 0), 0) || 0;
  const totalCost    = totalRevenue - totalGM;

  return NextResponse.json({
    steps: [
      { name: "Revenue",     value: totalRevenue },
      { name: "Cost",        value: -totalCost },
      { name: "Gross Margin", value: totalGM },
    ],
  });
}
