// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
  // Create a response we can pass to the helper (it will refresh cookies if needed)
  const res = NextResponse.next();

  // Initialize a Supabase client bound to this request/response
  const supabase = createMiddlewareClient({ req, res });

  // Read current session from cookies (will auto-refresh if expired)
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Public paths (no auth needed)
  const publicPaths = new Set<string>(['/', '/sign-in', '/sign-up']);
  const { pathname } = req.nextUrl;

  // Redirect unauthenticated users away from protected pages
  if (!publicPaths.has(pathname) && !session) {
    const url = req.nextUrl.clone();
    url.pathname = '/sign-in';
    url.searchParams.set('redirectedFrom', pathname);
    return NextResponse.redirect(url);
  }

  // Continue to the requested route
  return res;
}

// Apply to everything except Next internals and static assets
export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
};
