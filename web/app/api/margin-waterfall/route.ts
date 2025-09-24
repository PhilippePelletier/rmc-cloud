// web/app/api/margin-waterfall/route.ts
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
      .select("net_sales, gm_dollar")
      .eq("group_id", groupId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = data ?? [];
    const totalRevenue = rows.reduce((acc, r: any) => acc + Number(r.net_sales ?? 0), 0);
    const totalGM      = rows.reduce((acc, r: any) => acc + Number(r.gm_dollar ?? 0), 0);
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
