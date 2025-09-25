import { createClient } from "@supabase/supabase-js";

/**
 * Returns a Supabase client using the service role (full access).
 * **Server-side use only** – do not expose the service role key in the browser.
 */
export function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}
