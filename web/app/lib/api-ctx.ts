// app/lib/api-ctx.ts
import 'server-only';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function getApiContext() {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: Parameters<typeof cookieStore.set>[2]) {
          // Ensure we don't return a value (type expects void)
          cookieStore.set(name, value, options);
        },
        remove(name: string, options: Parameters<typeof cookieStore.set>[2]) {
          // Clear cookie by setting empty value + maxAge 0
          cookieStore.set(name, '', { ...options, maxAge: 0 });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return { error: NextResponse.json({ error: 'Auth required' }, { status: 401 }) } as const;
  }

  const groupId = data.user.id; // your routes already use this
  return { supabase, groupId } as const;
}
