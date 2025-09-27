// app/api/auth/set/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function POST(req: Request) {
  try {
    const { access_token, refresh_token } = await req.json();

    if (!access_token || !refresh_token) {
      return NextResponse.json({ error: 'Missing tokens' }, { status: 400 });
    }

    const cookieStore = cookies();
    const res = NextResponse.json({ ok: true });

    // Create a server client bound to this response's cookie mutators
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name) => cookieStore.get(name)?.value,
          set: (name, value, options) => {
            // write cookie on the response
            res.cookies.set({ name, value, ...options });
          },
          remove: (name, options) => {
            res.cookies.set({ name, value: '', ...options, maxAge: 0 });
          },
        },
      }
    );

    // Instruct Supabase to set its auth cookies on this response
    const { error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return res;
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Unexpected error' },
      { status: 500 }
    );
  }
}
