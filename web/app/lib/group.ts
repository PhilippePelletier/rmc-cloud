import { auth } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';

const supaAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // server-side only
);

/**
 * Returns:
 * - org UUID (as string) if a Clerk org is selected and mapped
 * - otherwise the Clerk user id
 */
export async function getCurrentGroupId(): Promise<string> {
  const { userId, orgId } = auth();
  if (!userId) throw new Error('Auth required');

  if (!orgId) return userId;

  // Map Clerk org -> local orgs.id (uuid)
  const { data, error } = await supaAdmin
    .from('orgs')
    .select('id, external_id')
    .eq('external_id', orgId)
    .maybeSingle();

  if (error) throw error;

  // If you don’t auto-provision orgs, fall back to personal if mapping is missing
  return data?.id ?? userId;
}

