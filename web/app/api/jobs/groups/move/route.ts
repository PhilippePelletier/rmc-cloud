// web/app/api/jobs/groups/move/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/app/lib/api-ctx";
import { getSupabaseAdminClient } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Move a job into a group, or ungroup it.
 * POST /api/jobs/groups/move
 * Body: { job_id: string, group_id?: string | null }
 *  - group_id = target folder id; pass null to remove from any folder
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getApiContext();
    if ("error" in ctx) return ctx.error;
    const { groupId } = ctx;

    const body = await req.json().catch(() => null);
    const job_id = String(body?.job_id || "").trim();
    const dest_group_id = body?.group_id ? String(body.group_id) : null;

    if (!job_id) {
      return NextResponse.json({ error: "Missing job_id" }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();

    // Optional safety: ensure the destination folder (if provided) belongs to this tenant
    if (dest_group_id) {
      const { data: folder, error: folderErr } = await admin
        .from("job_groups")
        .select("id,group_id")
        .eq("id", dest_group_id)
        .single();
      if (folderErr || !folder) {
        return NextResponse.json({ error: "Destination folder not found" }, { status: 404 });
      }
      if (folder.group_id !== groupId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Update the job row: set job_group_id (nullable)
    const { data, error } = await admin
      .from("jobs")
      .update({ job_group_id: dest_group_id })
      .eq("id", job_id)
      .eq("group_id", groupId) // tenant safety
      .select("id,job_group_id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, job: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
