// app/sign-in/page.tsx
'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';

export const dynamic = 'force-dynamic'; // avoid static pre-rendering

function SignInInner() {
  const router = useRouter();
  const params = useSearchParams();

  // Where to send users after successful auth
  const redirectedFrom = params.get('redirectedFrom') || '/dashboard';

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  // Status / error state
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [loadingPw, setLoadingPw] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingLinkedIn, setLoadingLinkedIn] = useState(false);
  const [loadingMagic, setLoadingMagic] = useState(false);

  async function handlePasswordSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (loadingPw || loadingGoogle || loadingLinkedIn || loadingMagic) return;
    setErrorMsg('');
    setLoadingPw(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoadingPw(false);

    if (error) {
      setErrorMsg(`${error.code ?? 'auth_error'}: ${error.message}`);
      return;
    }

    // Get current session from the browser client
    const { data: sess } = await supabase.auth.getSession();
    const at = sess?.session?.access_token;
    const rt = sess?.session?.refresh_token;

    if (!at || !rt) {
      setErrorMsg('No session returned. Check email confirmation settings in Supabase Auth.');
      return;
    }

    // Sync to server cookies
    const r = await fetch('/api/auth/set', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ access_token: at, refresh_token: rt }),
    });

    if (!r.ok) {
      let body: any = {};
      try { body = await r.json(); } catch {}
      setErrorMsg(`cookie_sync_error: ${body?.error ?? r.statusText}`);
      return;
    }

    router.push(redirectedFrom);
  }

  async function handleOAuth(provider: 'google' | 'linkedin_oidc') {
    if (loadingPw || loadingGoogle || loadingLinkedIn || loadingMagic) return;
    setErrorMsg('');
    provider === 'google' ? setLoadingGoogle(true) : setLoadingLinkedIn(true);

    // Keep the return target round-trip by appending ?redirectedFrom=...
    const redirectTo = `${window.location.origin}/dashboard?redirectedFrom=${encodeURIComponent(
      redirectedFrom
    )}`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });

    provider === 'google' ? setLoadingGoogle(false) : setLoadingLinkedIn(false);
    if (error) setErrorMsg(`${error.code ?? 'oauth_error'}: ${error.message}`);
  }

  async function handleMagicLink() {
    if (loadingPw || loadingGoogle || loadingLinkedIn || loadingMagic) return;
    setErrorMsg('');
    if (!email) {
      setErrorMsg('otp_error: enter your email to receive a magic link.');
      return;
    }
    setLoadingMagic(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // round-trip the intended destination too
        emailRedirectTo: `${window.location.origin}/dashboard?redirectedFrom=${encodeURIComponent(
          redirectedFrom
        )}`,
      },
    });

    setLoadingMagic(false);
    if (error) setErrorMsg(`${error.code ?? 'otp_error'}: ${error.message}`);
    else alert('Check your email for the magic link.');
  }

  const anyLoading = loadingPw || loadingGoogle || loadingLinkedIn || loadingMagic;

  return (
    <div className="flex justify-center mt-16 px-4">
      <form className="space-y-4 w-full max-w-sm" onSubmit={handlePasswordSignIn} aria-busy={anyLoading}>
        <h2 className="h2 text-center">Sign In</h2>

        {errorMsg ? (
          <p className="text-red-600 whitespace-pre-line rounded-md border border-red-200 bg-red-50 p-2 text-sm">
            {errorMsg}
          </p>
        ) : null}

        <div>
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            placeholder="you@company.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input w-full"
            autoComplete="email"
            disabled={anyLoading}
          />
        </div>

        <div>
          <label className="label" htmlFor="password">Password</label>
          <div className="relative">
            <input
              id="password"
              type={showPw ? 'text' : 'password'}
              placeholder="Your password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input w-full pr-20"
              autoComplete="current-password"
              disabled={anyLoading}
            />
            <button
              type="button"
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
              onClick={() => setShowPw((v) => !v)}
              aria-pressed={showPw}
              disabled={anyLoading}
            >
              {showPw ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <button type="submit" className="btn w-full" disabled={anyLoading}>
          {loadingPw ? 'Signing in…' : 'Sign In'}
        </button>

        <div className="text-center text-sm mt-2 text-gray-500">or</div>

        <button
          type="button"
          className="btn w-full"
          onClick={() => handleOAuth('google')}
          disabled={anyLoading}
        >
          {loadingGoogle ? 'Opening Google…' : 'Continue with Google'}
        </button>
        <button
          type="button"
          className="btn w-full"
          onClick={() => handleOAuth('linkedin_oidc')}
          disabled={anyLoading}
        >
          {loadingLinkedIn ? 'Opening LinkedIn…' : 'Continue with LinkedIn'}
        </button>

        <div className="border-t pt-3 text-sm flex items-center justify-between">
          <button type="button" className="link" onClick={handleMagicLink} disabled={anyLoading}>
            {loadingMagic ? 'Sending…' : 'Send me a magic link instead'}
          </button>
          <Link className="link" href={`/sign-up?redirectedFrom=${encodeURIComponent(redirectedFrom)}`}>
            Need an account?
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div />}>
      <SignInInner />
    </Suspense>
  );
}
