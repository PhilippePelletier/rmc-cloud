import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdminClient } from '@/app/lib/supabase';

/**
 * Determines the current workspace "group" (either an organization or a personal user).
 * Returns an object with `groupId` (org ID or user ID) and `groupType` ('org' or 'user').
 */
export async function getGroup() {
  const { userId, orgId } = auth();

  if (!userId) {
    return { groupId: null as string | null, groupType: null as 'org' | 'user' | null };
  }
  // Use organization ID if user is in an org, otherwise use personal userId
  if (orgId) {
    return { groupId: orgId, groupType: 'org' as const };
  }
  return { groupId: userId, groupType: 'user' as const };
}

/**
 * Ensures a row exists in the `orgs` table for the given orgId.
 * Should be called whenever we encounter a new organization context.
 */
export async function ensureOrg(orgId: string, name?: string) {
  if (!orgId) return;
  const supabaseAdmin = getSupabaseAdminClient();
  await supabaseAdmin.from('orgs').upsert({ id: orgId, name: name ?? orgId }).eq('id', orgId);
}
