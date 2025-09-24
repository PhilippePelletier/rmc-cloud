import { authMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export default authMiddleware({
  // Routes that anyone (signed in or not) can access
  publicRoutes: ['/', '/sign-in', '/sign-up'],

  // Run after Clerk has determined auth state
  afterAuth(auth, req) {
    // If the user is not signed in and the route isn't /sign-in, redirect
    if (!auth.userId && !req.nextUrl.pathname.startsWith('/sign-in')) {
      const signInUrl = new URL('/sign-in', req.url);
      return NextResponse.redirect(signInUrl);
    }
    // Otherwise allow the request to proceed
    return NextResponse.next();
  },
});

// Tell Next.js which paths this middleware should run on
export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)'],
};
