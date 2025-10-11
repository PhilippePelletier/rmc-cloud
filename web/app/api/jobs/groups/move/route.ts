// app/api/jobs/move/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/app/lib/api-ctx";
import { getSupabaseAdminClient } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // auth / context
    const ctx = await getApiContext();
    if ("error" in ctx) return ctx.error;
    const { groupId } = ctx;

    // payload
    const { job_id, folder_id } = await req.json();
    if (!job_id) {
      return NextResponse.json({ error: "Missing job_id" }, { status: 400 });
    }
    // folder_id can be null (drop into “Unfiled”)

    const admin = getSupabaseAdminClient();

    // (Optional) If you want to enforce the folder belongs to this group:
    if (folder_id) {
      const { data: folder, error: fErr } = await admin
        .from("job_folders")
        .select("id, group_id")
        .eq("id", folder_id)
        .single();
      if (fErr || !folder) {
        return NextResponse.json({ error: "Folder not found" }, { status: 404 });
      }
      if (folder.group_id !== groupId) {
        return NextResponse.json({ error: "Folder not in your group" }, { status: 403 });
      }
    }

    // Update the job -> set folder_id (NOT job_group_id)
    const { data, error } = await admin
      .from("jobs")
      .update({ folder_id: folder_id ?? null })
      .eq("id", job_id)
      .select("id, folder_id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, job_id: data.id, folder_id: data.folder_id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
