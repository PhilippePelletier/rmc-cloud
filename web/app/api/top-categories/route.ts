// web/app/api/top-categories/route.ts
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
      .from("daily_agg")
      .select("category, net_sales, gm_dollar, units")
      .eq("group_id", groupId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const agg: Record<string, { rev: number; gm: number; units: number }> = {};
    (data ?? []).forEach((r: any) => {
      const k = r.category || "Uncategorized";
      agg[k] ??= { rev: 0, gm: 0, units: 0 };
      agg[k].rev += Number(r.net_sales ?? 0);
      agg[k].gm  += Number(r.gm_dollar ?? 0);
      agg[k].units += Number(r.units ?? 0);
    });

    const rows = Object.entries(agg)
      .map(([category, v]) => ({
        category,
        rev: v.rev,
        gm: v.gm,
        units: v.units,
        gm_pct: v.rev ? v.gm / v.rev : 0,
      }))
      .sort((a, b) => b.rev - a.rev)
      .slice(0, 8);

    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: /auth required/i.test(e?.message) ? 401 : 500 }
    );
  }
}
