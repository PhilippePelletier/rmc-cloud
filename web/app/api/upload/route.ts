import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/app/lib/api-ctx";
import { getSupabaseAdminClient } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // enable Buffer usage in Node runtime

function isUuidLike(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function POST(req: NextRequest) {
  try {
    // 1) Authenticate and get Supabase client + current workspace (group)
    const { groupId, supabase } = await getApiContext();
    if ("error" in (groupId as any)) return groupId; // In case getApiContext returned an error response

    // 2) Parse the multipart form data
    const form = await req.formData();
    const kind = String(form.get("kind") || "");
    const file = form.get("file") as File | null;

    if (!file || !kind) {
      return NextResponse.json({ error: "Missing file or kind" }, { status: 400 });
    }

    // Basic validations on file
    if (!file.type.includes("csv")) {
      return NextResponse.json({ error: "Only CSV files are allowed" }, { status: 400 });
    }
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 25MB)" }, { status: 413 });
    }

    // 3) Use admin client for storage upload (service role)
    const supabaseAdmin = getSupabaseAdminClient();

    // Upload file to storage under a path namespaced by groupId
    const path = `${groupId}/${Date.now()}-${kind}.csv`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadResult = await supabaseAdmin.storage
      .from("rmc-uploads")
      .upload(path, buffer, { contentType: "text/csv", upsert: true });
    if (uploadResult.error) {
      return NextResponse.json({ error: uploadResult.error.message }, { status: 500 });
    }

    // 4) Insert a new job record via RLS client
    const orgIdForRow = isUuidLike(groupId) ? groupId : null;
    const { data: jobRow, error: insertError } = await supabase
      .from("jobs")
      .insert({
        group_id: groupId,
        org_id: orgIdForRow,
        kind,
        path,
        status: "queued",
      })
      .select("id")
      .single();
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // 5) Notify the worker to process this job (using a shared secret for auth)
    const res = await fetch(`${process.env.WORKER_URL}/jobs/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-RMC-Secret": process.env.WORKER_SHARED_SECRET!,
      },
      body: JSON.stringify({ job_id: jobRow.id }),
    }).catch(() => null);

    return NextResponse.json({
      status: "queued",
      job_id: jobRow.id,
      worker_notified: res?.ok ?? false,
    });
  } catch (err: any) {
    const msg = typeof err.message === "string" ? err.message : "Unexpected error";
    const status = /auth required/i.test(msg) ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
