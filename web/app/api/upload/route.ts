// app/api/uploads/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/app/lib/api-ctx";
import { getSupabaseAdminClient } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // we use Buffer; ensure Node runtime

function isUuidLike(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

// Use env to avoid hardcoding. Set on Vercel & Railway.
const UPLOADS_BUCKET = process.env.SUPABASE_UPLOADS_BUCKET || "rmc-uploads";

export async function POST(req: NextRequest) {
  try {
    // 1) Auth (RLS) — we query later with user client, but uploads use admin (service key)
    const ctx = await getApiContext();
    if ("error" in ctx) return ctx.error;
    const { groupId } = ctx;

    // 2) Parse form
    const form = await req.formData();
    const kind = String(form.get("kind") || "");
    const file = form.get("file") as File | null;
    const mappingStr = form.get("mapping");
    let mapping: any = null;
    if (mappingStr) {
      try {
        mapping = JSON.parse(String(mappingStr));
      } catch {
        return NextResponse.json({ error: "Invalid mapping JSON" }, { status: 400 });
      }
    }
    if (!file || !kind) {
      return NextResponse.json({ error: "Missing file or kind" }, { status: 400 });
    }

    // 3) Admin client (bypasses RLS for storage + jobs insert)
    const admin = getSupabaseAdminClient();

    // 3a) Sanity: check bucket exists in THIS project
    const { data: bucketInfo, error: bucketErr } = await admin.storage.getBucket(UPLOADS_BUCKET);
    if (bucketErr || !bucketInfo) {
      return NextResponse.json(
        {
          error: `Storage bucket "${UPLOADS_BUCKET}" not found in current Supabase project.`,
          hint:
            "Either the name is wrong or your SUPABASE_URL/SERVICE_ROLE key points to a different project. " +
            "Verify bucket name in Supabase → Storage and your env vars on Vercel/Railway.",
        },
        { status: 500 }
      );
    }

    // 4) Upload to storage
    const origName = (file as any).name ?? `${kind}.csv`;
    const ext = origName.includes(".") ? origName.slice(origName.lastIndexOf(".") + 1) : "csv";
    const safeKind = kind.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
    const path = `${groupId}/${safeKind}/${Date.now()}-${origName}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await admin.storage
      .from(UPLOADS_BUCKET)
      .upload(path, buffer, {
        contentType: file.type || (ext === "csv" ? "text/csv" : "application/octet-stream"),
        upsert: false, // safer: avoid silent overwrites
      });

    if (upErr) {
      // Surface exact storage error for quick diagnosis
      return NextResponse.json(
        {
          error: `Storage upload failed: ${upErr.message}`,
          bucket: UPLOADS_BUCKET,
          path,
        },
        { status: 500 }
      );
    }

    // 5) Insert job row (admin bypasses RLS)
    const orgIdForRow = isUuidLike(groupId) ? groupId : null;

    const insertPayload: Record<string, any> = {
      group_id: groupId,
      org_id: orgIdForRow,
      kind,
      path,
      status: "queued",
    };
    if (mapping) insertPayload.mapping = mapping; // only if you added a 'mapping' column to jobs

    const { data: jobRow, error: jobsErr } = await admin
      .from("jobs")
      .insert(insertPayload)
      .select("id")
      .single();

    if (jobsErr) {
      return NextResponse.json(
        {
          error: `DB insert into jobs failed: ${jobsErr.message}`,
          hint:
            "If this says 'permission denied', you are using a non-service client by mistake. " +
            "Make sure getSupabaseAdminClient() uses SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 500 }
      );
    }

        // 6) Notify worker
    const payload: any = { job_id: jobRow.id };
    if (mapping) payload.mapping = mapping;
    
    const workerUrl = process.env.WORKER_URL;
    let worker_notified = false;
    let worker_status: number | null = null;
    let worker_text: string | null = null;
    
    if (workerUrl) {
      try {
        const res = await fetch(`${workerUrl}/jobs/process`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-RMC-Secret": process.env.WORKER_SHARED_SECRET || "",
          },
          body: JSON.stringify(payload),
        });
        worker_notified = res.ok;
        worker_status = res.status;
        worker_text = await res.text().catch(() => null);
      } catch (e: any) {
        worker_text = e?.message || String(e);
      }
    }
    
    return NextResponse.json({
      status: "queued",
      job_id: jobRow.id,
      worker_notified,
      worker_status,
      worker_text,
      storage: { bucket: UPLOADS_BUCKET, path },
    });

  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Unexpected error";
    const status = /auth required/i.test(msg) ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
