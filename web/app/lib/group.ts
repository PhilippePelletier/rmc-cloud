// web/app/lib/group.ts
import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

// Admin client — uses service role on the server only
const supaAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // NEVER expose to the browser
  { auth: { persistSession: false } }
);

/**
 * Returns the current "group" identifier and its type.
 * - If the user is inside a Clerk organization, we use the organization ID.
 * - Otherwise we use the user's Clerk userId.
 *
 * This is the single place to derive group scope for all API routes.
 */
export async function getGroup() {
  const { userId, orgId } = auth();

  if (!userId) {
    return { groupId: null as string | null, groupType: null as 'org' | 'user' | null };
  }

  // Prefer org when present
  if (orgId) {
    return { groupId: orgId, groupType: 'org' as const };
  }

  return { groupId: userId, groupType: 'user' as const };
}

/**
 * Optional: ensure there is a row in `orgs` when we see a new orgId.
 * Call this AFTER getGroup() whenever groupType === 'org'.
 */
export async function ensureOrg(orgId: string, name?: string) {
  if (!orgId) return;
  await supaAdmin.from('orgs').upsert({ id: orgId, name: name ?? orgId }).eq('id', orgId);
}
