import 'server-only';
import { NextResponse } from 'next/server';
import { getGroup, ensureOrg } from '@/app/lib/group';
import { getSupabaseClientForUser } from '@/app/lib/supabase-rls';

export async function getApiContext() {
  const { groupId, groupType } = await getGroup();
  if (!groupId) {
    // Not authenticated
    return { error: NextResponse.json({ error: 'Auth required' }, { status: 401 }) } as const;
  }
  // If in an organization context, ensure an org record exists in DB
  if (groupType === 'org') {
    await ensureOrg(groupId);
  }
  // Supabase client with user JWT for RLS
  const supabase = await getSupabaseClientForUser();
  return { supabase, groupId, groupType } as const;
}
