import { createClient } from '@supabase/supabase-js';
import { getToken } from '@clerk/nextjs';

export async function supaRls() {
  const jwt = await getToken({ template: 'supabase' }); // Clerk JWT template you saved earlier
  if (!jwt) throw new Error('Missing JWT for Supabase');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  );
}
