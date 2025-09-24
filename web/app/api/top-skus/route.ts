// web/app/api/top-skus/route.ts
import { NextResponse } from "next/server";
import { supaRls } from "@/app/lib/supabase-rls";     // RLS client (Clerk JWT template "supabase")
import { getCurrentGroupId } from "@/app/lib/group";  // org UUID string if org selected, else userId

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1) Resolve workspace (org uuid string OR user id)
    const groupId = await getCurrentGroupId();

    // 2) Use RLS-enforced client
    const supa = await supaRls();

    // 3) Filter by group_id (TEXT), not org_id
    const { data, error } = await supa
      .from("sales")
      .select("sku, net_sales, gm_dollar, units")
      .eq("group_id", groupId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 4) Aggregate values by SKU
    const agg: Record<string, { revenue: number; gm_dollar: number; units: number }> = {};
    for (const row of data ?? []) {
      const sku = (row as any).sku || "Unknown";
      agg[sku] ??= { revenue: 0, gm_dollar: 0, units: 0 };
      agg[sku].revenue   += Number((row as any).net_sales ?? 0);
      agg[sku].gm_dollar += Number((row as any).gm_dollar ?? 0);
      agg[sku].units     += Number((row as any).units ?? 0);
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
      .slice(0, 10); // top 10 by revenue

    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: /auth required/i.test(e?.message) ? 401 : 500 }
    );
  }
}

