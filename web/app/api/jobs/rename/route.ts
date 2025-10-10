// web/app/api/jobs/rename/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getApiContext } from '@/app/lib/api-ctx';
import { getSupabaseAdminClient } from '@/app/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ctx = await getApiContext();
  if ('error' in ctx) return ctx.error;
  const { supabase, groupId } = ctx;
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || '').trim();
  const newName = String(body.newName || '').trim();
  if (!id || !newName) {
    return NextResponse.json({ error: 'Missing job id or new name' }, { status: 400 });
  }

  // Verify ownership and get current path
  const { data: job, error: getErr } = await supabase
    .from('jobs')
    .select('id, group_id, kind, path')
    .eq('id', id)
    .single();
  if (getErr) {
    return NextResponse.json({ error: getErr.message }, { status: 400 });
  }
  if (!job || job.group_id !== groupId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Compute new storage path
  const safeKind = job.kind.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  const sanitized = newName.replace(/[^a-z0-9._-]/gi, '-');
  const timestamp = Date.now();
  const parts = job.path.split('/');
  const folder = parts.slice(0, 2).join('/'); // e.g. "groupId/sales"
  const newPath = `${folder}/${timestamp}-${sanitized}`;

  // Move file in Supabase storage (renaming it)
  const admin = getSupabaseAdminClient();
  const bucket = process.env.SUPABASE_UPLOADS_BUCKET || 'rmc-uploads';
  const { error: moveErr } = await admin.storage
    .from(bucket)
    .move(job.path, newPath);
  if (moveErr) {
    return NextResponse.json({ error: `Failed to rename file: ${moveErr.message}` }, { status: 500 });
  }

  // Update the job record with the new path
  const { error: updateErr } = await admin
    .from('jobs')
    .update({ path: newPath, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ status: 'renamed', job_id: id });
}
