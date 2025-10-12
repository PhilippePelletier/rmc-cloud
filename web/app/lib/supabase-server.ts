// app/lib/supabase-server.ts
'use server';

import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Optional: log once on boot to help diagnose env issues
  console.warn(
    '[supabase-server] Missing SUPABASE env. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
  );
}

export function getSupabaseServerClient() {
  const store = cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return store.get(name)?.value;
      },
      set(name: string, value: string, options?: CookieOptions) {
        // Next.js App Router cookies() API uses set() for both set & remove
        store.set({
          name,
          value,
          ...options,
        });
      },
      remove(name: string, options?: CookieOptions) {
        store.set({
          name,
          value: '',
          ...options,
          maxAge: 0,
        });
      },
    },
    // NOTE: Do not pass `headers` here — your installed @supabase/ssr types
    // only support { cookies }.
  });
}

export async function getServerSession() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  return {
    user: data?.user ?? null,
    error: error?.message ?? null,
  };
}
