// web/app/api/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supaRls } from "@/app/lib/supabase-rls";     // DB via RLS (Clerk JWT template "supabase")
import { getCurrentGroupId } from "@/app/lib/group";  // org UUID string if org selected, else userId
import { createClient } from "@supabase/supabase-js"; // service client for Storage + admin ops

export const dynamic = "force-dynamic";

function isUuidLike(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function POST(req: NextRequest) {
  try {
    // 1) Resolve workspace key
    const groupId = await getCurrentGroupId(); // string: org uuid or userId

    // 2) Parse form-data
    const form = await req.formData();
    const kind = String(form.get("kind") || "");
    const file = form.get("file") as File | null;
    if (!file || !kind) {
      return NextResponse.json({ error: "Missing file/kind" }, { status: 400 });
    }

    // 3) Use SERVICE client for Storage (separate from RLS DB client)
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
    const supa = await supaRls();

    // If groupId is an org UUID, persist it in org_id; otherwise keep org_id = null for personal space
    const orgIdForRow = isUuidLike(groupId) ? groupId : null;

    const { data, error: insErr } = await supa
      .from("jobs")
      .insert({
        group_id: groupId,     // ALWAYS set
        org_id: orgIdForRow,   // set only if groupId looks like a UUID (org)
        kind,
        path,
        status: "queued",
      })
      .select("id")
      .single();

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    // 6) Notify the worker
    const url = `${process.env.WORKER_URL}/jobs/process`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-RMC-Secret": process.env.WORKER_SHARED_SECRET!,
      },
      body: JSON.stringify({ job_id: data.id }),
    }).catch(() => null);

    return NextResponse.json({
      status: "queued",
      job_id: data.id,
      worker_notified: res?.ok ?? false,
    });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Unexpected error";
    const code = /auth required/i.test(msg) ? 401 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}
