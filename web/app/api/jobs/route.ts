// app/api/jobs/route.ts
import { NextResponse } from "next/server";
import { getApiContext } from "@/app/lib/api-ctx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // 1) Centralized auth + group + RLS client
  const ctx = await getApiContext();
  if ("error" in ctx) return ctx.error;
  const { supa, groupId } = ctx;

  // 2) Query jobs for this tenant (user or org) via RLS client
  const { data, error } = await supa
    .from("jobs")
    .select("id, kind, status, message, created_at, updated_at")
    .eq("group_id", groupId)              // ← scope by TEXT group_id
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ jobs: data ?? [] });
}

