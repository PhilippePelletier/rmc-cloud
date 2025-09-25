import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/app/lib/api-ctx";
import { getSupabaseAdminClient } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // enable Buffer usage in Node runtime

function isUuidLike(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

// ... (imports and setup unchanged)
export async function POST(req: NextRequest) {
  try {
    // 1) Auth and Supabase setup (no changes)
    const context = await getApiContext();
    if ('error' in context) {
      // `context.error` already is a NextResponse (e.g. a 401 JSON error)
      return context.error;
    }
    const { groupId, supabase } = context;
// ... proceed as normal


    // 2) Parse the multipart form data
    const form = await req.formData();
    const kind = String(form.get("kind") || "");
    const file = form.get("file") as File | null;
    const mappingStr = form.get("mapping");  // NEW: get mapping JSON string if provided
    let mapping: any = null;
    if (mappingStr) {
      try {
        mapping = JSON.parse(String(mappingStr));
      } catch {
        return NextResponse.json({ error: "Invalid mapping data" }, { status: 400 });
      }
    }
    if (!file || !kind) {
      return NextResponse.json({ error: "Missing file or kind" }, { status: 400 });
    }
    // ... (file type/size validations unchanged)
    // 3) Upload file to storage (unchanged)
    const supabaseAdmin = getSupabaseAdminClient();
    const path = `${groupId}/${Date.now()}-${kind}.csv`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadResult = await supabaseAdmin.storage
      .from("rmc-uploads")
      .upload(path, buffer, { contentType: "text/csv", upsert: true });
    if (uploadResult.error) {
      return NextResponse.json({ error: uploadResult.error.message }, { status: 500 });
    }
    // 4) Insert new job record (unchanged)
  const supabaseAdmin = getSupabaseAdminClient();
  const orgIdForRow = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5]/.test(groupId) ? groupId : null;
  
  const { data: jobRow, error: insertError } = await supabaseAdmin  // use admin client
    .from("jobs")
    .insert({
      group_id: groupId,
      org_id: orgIdForRow,
      kind,
      path,
      status: "queued",
      ...(mapping ? { mapping: mapping } : {})  // include mapping JSON if column exists
    })
    .select("id")
    .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    // 5) Notify the worker to process this job, including mapping if present
    const payload: any = { job_id: jobRow.id };
    if (mapping) payload.mapping = mapping;
    const res = await fetch(`${process.env.WORKER_URL}/jobs/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-RMC-Secret": process.env.WORKER_SHARED_SECRET!
      },
      body: JSON.stringify(payload)
    }).catch(() => null);

    return NextResponse.json({
      status: "queued",
      job_id: jobRow.id,
      worker_notified: res?.ok ?? false
    });
  } catch (err: any) {
    const msg = typeof err.message === "string" ? err.message : "Unexpected error";
    const status = /auth required/i.test(msg) ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
