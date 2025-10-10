// web/app/api/jobs/delete/route.ts
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
  if (!id) {
    return NextResponse.json({ error: 'Missing job id' }, { status: 400 });
  }

  // Verify ownership and get file path
  const { data: job, error: getErr } = await supabase
    .from('jobs')
    .select('id, group_id, path')
    .eq('id', id)
    .single();
  if (getErr) {
    return NextResponse.json({ error: getErr.message }, { status: 400 });
  }
  if (!job || job.group_id !== groupId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const admin = getSupabaseAdminClient();
  const bucket = process.env.SUPABASE_UPLOADS_BUCKET || 'rmc-uploads';

  // Remove file from Supabase storage
  if (job.path) {
    const { error: storageErr } = await admin.storage
      .from(bucket)
      .remove([job.path]);
    if (storageErr) {
      return NextResponse.json({ error: `Failed to delete file: ${storageErr.message}` }, { status: 500 });
    }
  }

  // Delete the job row from the database
  const { error: delErr } = await admin
    .from('jobs')
    .delete()
    .eq('id', id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ status: 'deleted', job_id: id });
}
