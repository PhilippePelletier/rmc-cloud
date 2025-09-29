// app/api/jobs/relaunch/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { getApiContext } from "@/app/lib/api-ctx";
import { getSupabaseAdminClient } from "@/app/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // 1) Auth
  const ctx = await getApiContext();
  if ("error" in ctx) return ctx.error;
  const { supabase, groupId } = ctx;

  // 2) Parse body
  const body = await req.json().catch(() => null);
  const id = (body?.id ?? "").toString().trim();
  if (!id) {
    return NextResponse.json({ error: "Missing job id" }, { status: 400 });
  }

  // 3) Ownership check via RLS client
  const { data: job, error: getErr } = await supabase
    .from("jobs")
    .select("id, group_id")
    .eq("id", id)
    .single();

  if (getErr) {
    return NextResponse.json({ error: getErr.message }, { status: 400 });
  }
  if (!job || job.group_id !== groupId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 4) Update status + ping worker using admin client (bypass RLS for write)
  const admin = getSupabaseAdminClient();
  const { error: updErr } = await admin
    .from("jobs")
    .update({ status: "queued", message: null, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // 5) Notify worker
  const workerUrl = process.env.WORKER_URL;
  const secret = process.env.WORKER_SHARED_SECRET;
  let worker_ok = false;

  if (workerUrl && secret) {
    try {
      const res = await fetch(`${workerUrl.replace(/\/+$/,'')}/jobs/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-RMC-Secret": secret,
        },
        body: JSON.stringify({ job_id: id }),
      });
      worker_ok = res.ok;
    } catch {
      worker_ok = false;
    }
  }

  return NextResponse.json({ ok: true, worker_ok });
}
