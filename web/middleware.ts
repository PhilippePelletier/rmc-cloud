// web/middleware.ts
import { NextResponse } from 'next/server';
import { createMiddlewareSupabaseClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req) {
  // Create a response object so we can modify headers if needed
  const res = NextResponse.next();

  // Initialize Supabase client for middleware context
  const supabase = createMiddlewareSupabaseClient({ req, res });

  // Get the current session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const publicPaths = ['/', '/sign-in', '/sign-up'];
  const { pathname } = req.nextUrl;

  // If the route is not public and there is no session, redirect to sign-in
  if (!publicPaths.includes(pathname) && !session) {
    const signInUrl = new URL('/sign-in', req.url);
    return NextResponse.redirect(signInUrl);
  }

  return res;
}

export const config = {
  matcher: ['/((?!\\..*$|_next).*)'],  // Apply to all but static files and _next
};
