// app/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const next = url.searchParams.get('next') || '/dashboard';

  // Bind supabase to Next cookies; this will exchange the 'code' for a session
  // and set the auth cookies automatically.
  const supabase = createRouteHandlerClient({ cookies });

  // This call ensures cookies are set for the session just created by the OAuth/magic link redirect
  await supabase.auth.getSession();

  return NextResponse.redirect(new URL(next, url.origin));
}
