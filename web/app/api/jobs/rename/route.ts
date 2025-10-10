// app/api/jobs/rename/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!; // server-only
const UPLOADS_BUCKET = process.env.SUPABASE_UPLOADS_BUCKET || 'rmc-uploads';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Supabase env vars are not set');
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type JobRow = {
  id: string;
  path: string;
  display_name: string | null;
  // include anything else you store if needed
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = String(body?.id || '').trim();
    const newName = String(body?.newName || '').trim();

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    if (!newName) return NextResponse.json({ error: 'Missing newName' }, { status: 400 });
    if (newName.includes('/')) {
      return NextResponse.json({ error: 'newName cannot contain "/"' }, { status: 400 });
    }

    // 1) Load the job
    const { data: job, error: selErr } = await admin
      .from('jobs')
      .select('id, path, display_name')
      .eq('id', id)
      .single<JobRow>();
    if (selErr || !job) throw new Error(selErr?.message || 'Job not found');

    const oldPath = job.path || '';
    if (!oldPath) throw new Error('Job has empty path');

    // 2) Compute new path in same folder
    const lastSlash = oldPath.lastIndexOf('/');
    const folder = lastSlash >= 0 ? oldPath.slice(0, lastSlash) : '';
    const oldFile = lastSlash >= 0 ? oldPath.slice(lastSlash + 1) : oldPath;

    // Preserve timestamp prefix if it exists: "1234567890123-"
    let prefix = '';
    const dashIdx = oldFile.indexOf('-');
    if (dashIdx > 0 && /^\d{10,}$/.test(oldFile.slice(0, dashIdx))) {
      prefix = oldFile.slice(0, dashIdx + 1); // keep "digits-"
    }

    const newFile = `${prefix}${newName}`;
    const newPath = folder ? `${folder}/${newFile}` : newFile;

    if (newPath === oldPath) {
      return NextResponse.json({ ok: true, path: newPath, displayName: newName });
    }

    // 3) Move in Storage
    const { error: moveErr } = await admin.storage.from(UPLOADS_BUCKET).move(oldPath, newPath);
    if (moveErr) throw new Error(`Storage move failed: ${moveErr.message}`);

    // 4) Update DB (path + display_name)
    const { error: updErr } = await admin
      .from('jobs')
      .update({ path: newPath, display_name: newName, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (updErr) {
      // try to move back to reduce inconsistent state
      await admin.storage.from(UPLOADS_BUCKET).move(newPath, oldPath);
      throw new Error(`DB update failed: ${updErr.message}`);
    }

    return NextResponse.json({ ok: true, path: newPath, displayName: newName });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Rename failed' }, { status: 500 });
  }
}
