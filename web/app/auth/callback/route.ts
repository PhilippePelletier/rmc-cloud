// app/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const next = url.searchParams.get('next') || '/dashboard';

  const supabase = createRouteHandlerClient({ cookies });
  await supabase.auth.exchangeCodeForSession();

  return NextResponse.redirect(new URL(next, req.url));
}
