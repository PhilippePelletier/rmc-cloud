// web/app/api/jobs/route.ts
import { NextResponse } from "next/server";
import { supaRls } from "@/app/lib/supabase-rls";     // RLS client (uses Clerk JWT template "supabase")
import { getCurrentGroupId } from "@/app/lib/group";  // returns org UUID string if org selected, else userId

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1) Resolve the workspace (org uuid as string OR user id)
    const groupId = await getCurrentGroupId();

    // 2) Use RLS-enforced client
    const supa = await supaRls();

    // 3) Filter by group_id (TEXT), not org_id
    const { data, error } = await supa
      .from("jobs")
      .select("id, kind, status, message, created_at, updated_at")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ jobs: data ?? [] });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: /auth required/i.test(e?.message) ? 401 : 500 }
    );
  }
}
