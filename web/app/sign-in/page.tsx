// app/sign-in/page.tsx
'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic'; // avoid static pre-rendering

function SignInInner() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectedFrom = params.get('redirectedFrom') || '/dashboard';

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [errorMsg, setErrorMsg] = useState<string>('');

  // separate loading flags
  const [loadingPw, setLoadingPw] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingLinkedIn, setLoadingLinkedIn] = useState(false);
  const [loadingMagic, setLoadingMagic] = useState(false);

  async function handlePasswordSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (loadingPw || loadingGoogle || loadingLinkedIn || loadingMagic) return;
    setErrorMsg('');
    setLoadingPw(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

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
      const body = await r.json().catch(() => ({}));
      setErrorMsg(`cookie_sync_error: ${body?.error ?? r.statusText}`);
      return;
    }

    // Now the middleware will see an authenticated session
    window.location.assign(redirectedFrom);
  }

  async function handleOAuth(provider: 'google' | 'linkedin_oidc') {
    if (loadingPw || loadingGoogle || loadingLinkedIn || loadingMagic) return;
    setErrorMsg('');
    if (provider === 'google') setLoadingGoogle(true);
    else setLoadingLinkedIn(true);

    try {
      // After auth callback syncs cookies, land on the intended page
      const next = redirectedFrom || '/dashboard';
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });

      if (error) setErrorMsg(`${error.code ?? 'oauth_error'}: ${error.message}`);
      // Do not manually navigate here; the browser leaves this page for the provider.
    } finally {
      if (provider === 'google') setLoadingGoogle(false);
      else setLoadingLinkedIn(false);
    }
  }

  async function handleMagicLink() {
    if (loadingPw || loadingGoogle || loadingLinkedIn || loadingMagic) return;
    setErrorMsg('');
    if (!email) {
      setErrorMsg('otp_error: enter your email to receive a magic link.');
      return;
    }
    setLoadingMagic(true);

    // After clicking the email link, user returns to /auth/callback which syncs cookies then redirects to `next`
    const next = redirectedFrom || '/dashboard';
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    setLoadingMagic(false);
    if (error) setErrorMsg(`${error.code ?? 'otp_error'}: ${error.message}`);
    else alert('Check your email for the magic link.');
  }

  return (
    <div className="flex justify-center mt-20">
      <form className="space-y-4 w-full max-w-sm" onSubmit={handlePasswordSignIn}>
        <h2 className="h2">Sign In</h2>

        {errorMsg && <p className="text-red-600 whitespace-pre-line">{errorMsg}</p>}

        <input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input w-full"
          autoComplete="email"
        />
        <input
          type="password"
          placeholder="Password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input w-full"
          autoComplete="current-password"
        />

        <button type="submit" className="btn w-full" disabled={loadingPw || loadingGoogle || loadingLinkedIn || loadingMagic}>
          {loadingPw ? 'Signing in…' : 'Sign In'}
        </button>

        <div className="text-center text-sm mt-2">or</div>

        <button
          type="button"
          className="btn w-full"
          onClick={() => handleOAuth('google')}
          disabled={loadingPw || loadingGoogle || loadingLinkedIn || loadingMagic}
        >
          {loadingGoogle ? 'Opening Google…' : 'Continue with Google'}
        </button>

        <button
          type="button"
          className="btn w-full"
          onClick={() => handleOAuth('linkedin_oidc')}
          disabled={loadingPw || loadingGoogle || loadingLinkedIn || loadingMagic}
        >
          {loadingLinkedIn ? 'Opening LinkedIn…' : 'Continue with LinkedIn'}
        </button>

        <div className="border-t pt-3 text-sm">
          <button
            type="button"
            className="link"
            onClick={handleMagicLink}
            disabled={loadingPw || loadingGoogle || loadingLinkedIn || loadingMagic}
          >
            {loadingMagic ? 'Sending…' : 'Send me a magic link instead'}
          </button>
        </div>

        <p className="text-sm text-center">
          No account? <a href="/sign-up" className="link">Sign up here</a>
        </p>
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

