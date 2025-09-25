// app/api/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/app/lib/api";              // unified: { groupId, supa } (RLS client)
import { createClient } from "@supabase/supabase-js";       // service client for Storage + admin ops

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // required to use Buffer in route handlers

function isUuidLike(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function POST(req: NextRequest) {
  try {
    // 1) Auth + workspace (org UUID or userId) + RLS client
    const { groupId, supa } = await getApiContext(); // throws 401 if not signed-in

    // 2) Parse form-data
    const form = await req.formData();
    const kind = String(form.get("kind") || "");
    const file = form.get("file") as File | null;

    if (!file || !kind) {
      return NextResponse.json({ error: "Missing file/kind" }, { status: 400 });
    }

    // Optional: basic guardrails on file type/size
    if (!file.type?.includes("csv")) {
      return NextResponse.json({ error: "Only CSV files are allowed" }, { status: 400 });
    }
    if (file.size > 25 * 1024 * 1024) { // 25 MB
      return NextResponse.json({ error: "File too large (max 25MB)" }, { status: 413 });
    }

    // 3) SERVICE client for Storage (separate from RLS DB client)
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // server-only
    );

    // 4) Upload file to Storage under a namespaced path by groupId
    const path = `${groupId}/${Date.now()}-${kind}.csv`;
    const buf = Buffer.from(await file.arrayBuffer());
    const up = await admin.storage
      .from("rmc-uploads")
      .upload(path, buf, { contentType: "text/csv", upsert: true });

    if (up.error) {
      return NextResponse.json({ error: up.error.message }, { status: 500 });
    }

    // 5) Insert a job row via RLS client (policies must allow insert when group_id = jwt claim)
    // If groupId is an org UUID, set org_id; else keep org_id = null for personal space.
    const orgIdForRow = isUuidLike(groupId) ? groupId : null;

    const { data: jobRow, error: insErr } = await supa
      .from("jobs")
      .insert({
        group_id: groupId,   // ALWAYS set (TEXT: org uuid or userId)
        org_id: orgIdForRow, // nullable for personal workspaces
        kind,
        path,
        status: "queued",
      })
      .select("id")
      .single();

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    // 6) Notify the worker (shared secret)
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
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Unexpected error";
    const code = /auth required/i.test(msg) ? 401 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}

