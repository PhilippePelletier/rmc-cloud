// web/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PROTECTED_PREFIXES = ['/dashboard', '/uploads', '/jobs', '/brief'];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Server-side Supabase client wired to Next cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        // keep cookies updated on the response
        set(name: string, value: string, options: Parameters<NextResponse['cookies']['set']>[2]) {
          res.cookies.set(name, value, options);
        },
        remove(name: string, options: Parameters<NextResponse['cookies']['set']>[2]) {
          res.cookies.set(name, '', { ...options, maxAge: 0 });
        },
      },
    }
  );

  const { data } = await supabase.auth.getUser();
  const user = data?.user ?? null;

  const url = req.nextUrl;
  const path = url.pathname;

  const isAuthPage =
    path === '/sign-in' || path === '/sign-up' || path === '/signin' || path === '/signup';

  /* ----------------------------------------------------------
   * NEW: Friendly landing page routing
   * - Anonymous on "/" -> rewrite to "/welcome"
   * - Signed-in on "/welcome" -> redirect to "/dashboard"
   * ---------------------------------------------------------- */
  if (!user && (path === '/' || path === '')) {
    const rewriteUrl = url.clone();
    rewriteUrl.pathname = '/welcome';
    return NextResponse.rewrite(rewriteUrl);
  }

  if (user && path === '/welcome') {
    const redirectUrl = url.clone();
    redirectUrl.pathname = '/dashboard';
    return NextResponse.redirect(redirectUrl);
  }

  // 1) Block protected pages when logged out
  if (!user && PROTECTED_PREFIXES.some((p) => path.startsWith(p))) {
    const redirectUrl = new URL('/sign-in', req.url);
    redirectUrl.searchParams.set('redirectedFrom', path);
    return NextResponse.redirect(redirectUrl);
  }

  // 2) Bounce authenticated users away from auth pages
  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return res;
}

// Exclude static assets and your auth cookie sync endpoint from middleware
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api/auth/set).*)',
  ],
};
