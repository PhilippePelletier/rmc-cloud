import 'server-only';
import { NextResponse } from 'next/server';
import { getGroup } from '@/app/lib/group';
import { supaRls } from '@/app/lib/supabase-rls';

export async function getApiContext() {
  const { groupId, groupType } = await getGroup();
  if (!groupId) {
    // convenience you can reuse
    return { error: NextResponse.json({ error: 'Auth required' }, { status: 401 }) } as const;
  }
  const supa = supaRls();
  return { supa, groupId, groupType } as const;
}

