// web/app/api/top-skus/route.ts
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

  const { data, error } = await supa
    .from("sales")
    .select("sku, net_sales, gm_dollar, units")
    .eq("org_id", groupId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Aggregate values by SKU
  const agg: Record<string, { revenue: number; gm_dollar: number; units: number }> = {};
  for (const row of data || []) {
    const sku = row.sku || "Unknown";
    agg[sku] ??= { revenue: 0, gm_dollar: 0, units: 0 };
    agg[sku].revenue  += Number(row.net_sales || 0);
    agg[sku].gm_dollar += Number(row.gm_dollar || 0);
    agg[sku].units    += Number(row.units || 0);
  }

  const rows = Object.entries(agg)
    .map(([sku, v]) => ({
      sku,
      revenue: v.revenue,
      gm_dollar: v.gm_dollar,
      gm_pct: v.revenue ? v.gm_dollar / v.revenue : 0,
      units: v.units,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10); // return top 10 by revenue

  return NextResponse.json({ rows });
}
