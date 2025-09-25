import { NextResponse } from "next/server";
import { getApiContext } from "@/app/lib/api-ctx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // 1) Get Supabase client and current group context
  const ctx = await getApiContext();
  if ("error" in ctx) return ctx.error;
  const { supabase, groupId } = ctx;

  // 2) Query jobs for this workspace (limit 20, latest first)
  const { data, error } = await supabase
    .from("jobs")
    .select("id, kind, status, message, created_at, updated_at")
    .eq("group_id", groupId)               // scope to current user/org
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ jobs: data ?? [] });
}
