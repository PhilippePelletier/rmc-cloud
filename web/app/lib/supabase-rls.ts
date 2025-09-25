import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

/**
 * Returns a Supabase client authenticated with the current user's JWT for RLS.
 * Throws an error if the user is not signed in or no Supabase token is available.
 */
export async function getSupabaseClientForUser() {
  const { userId, getToken } = auth();
  if (!userId) throw new Error("Auth required");
  const token = await getToken({ template: "supabase" });
  if (!token) throw new Error("Auth required: no Supabase token");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anonKey, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });
}
