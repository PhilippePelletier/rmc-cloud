// web/app/lib/supabase-server.ts
import { cookies, headers } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export function createSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
      headers: {
        get(key: string) {
          return headers().get(key) ?? undefined;
        },
      },
    }
  );
}

export async function getServerSession() {
  const supabase = createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  return { user: data.user ?? null };
}
