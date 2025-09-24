import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supaService } from "../../lib/supabase";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { userId, orgId } = auth();
  if (!userId) {
    return NextResponse.json({ error: 'Auth required' }, { status: 401 });
  }
  
  // Use the organization if present, otherwise fall back to the user ID.
  const groupId = orgId ?? userId;

  const form = await req.formData();
  const kind = String(form.get("kind"));
  const file = form.get("file") as File | null;
  if (!file || !kind) return NextResponse.json({ error: "Missing file/kind" }, { status: 400 });

  const supa = supaService();
  const path = `${groupId}/${Date.now()}-${kind}.csv`;
  const buf = Buffer.from(await file.arrayBuffer());
  const up = await supa.storage.from("rmc-uploads").upload(path, buf, { contentType: "text/csv", upsert: true });
  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });

  // record upload + job
  const { error: insErr, data } = await supa.from("jobs").insert({ org_id: groupId, kind, path, status: "queued" }).select("id").single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // notify worker
  const url = process.env.WORKER_URL! + "/jobs/process";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-RMC-Secret": process.env.WORKER_SHARED_SECRET! },
    body: JSON.stringify({ job_id: data.id })
  }).catch(()=>null);

  return NextResponse.json({ status: "queued", job_id: data.id, worker_notified: res?.ok ?? false });
}
