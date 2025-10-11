// web/app/api/jobs/groups/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/app/lib/api-ctx";
import { getSupabaseAdminClient } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * List groups (folders) for the current workspace/tenant.
 * GET /api/jobs/groups
 */
export async function GET(_req: NextRequest) {
  try {
    const ctx = await getApiContext();
    if ("error" in ctx) return ctx.error;
    const { groupId } = ctx;

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from("job_groups")
      .select("id,name,parent_id,created_at,updated_at")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ groups: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}

/**
 * Create a group (folder).
 * POST /api/jobs/groups
 * Body: { name: string, parent_id?: string | null }
 * NOTE: group_id is derived from auth context; do NOT send it from the client.
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getApiContext();
    if ("error" in ctx) return ctx.error;
    const { groupId } = ctx;

    const body = await req.json().catch(() => null);
    const name = String(body?.name || "").trim();
    const parent_id = body?.parent_id ? String(body.parent_id) : null;

    if (!name) {
      return NextResponse.json({ error: "Missing name" }, { status: 400 });
    }
    if (!groupId) {
      return NextResponse.json({ error: "Missing group context" }, { status: 401 });
    }

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from("job_groups")
      .insert({ name, parent_id, group_id: groupId })
      .select("id,name,parent_id,created_at,updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ group: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
