// web/app/lib/api-ctx.ts
import 'server-only';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '@/app/lib/supabase';

export async function getApiContext() {
  // Read Supabase access token from cookie
  const cookieStore = cookies();
  const token = cookieStore.get('sb-access-token')?.value;
  if (!token) {
    return {
      error: NextResponse.json({ error: 'Auth required' }, { status: 401 })
    } as const;
  }

  // Verify token and get user ID
  const supabaseAdmin = getSupabaseAdminClient();
  const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !user) {
    return {
      error: NextResponse.json({ error: userErr?.message ?? 'Auth error' }, { status: 401 })
    } as const;
  }
  const groupId = user.id;

  // Create Supabase client with the user's JWT (for RLS)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    }
  );

  return { supabase, groupId };
}
