// web/app/sign-up/page.tsx
'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function SignUpInner() {
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
  const [showPw, setShowPw] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);

    // Sign up the user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard?redirectedFrom=${encodeURIComponent(
          redirectedFrom
        )}`,
      },
    });

    setLoading(false);

    if (error) {
      setErrorMsg(`${error.code ?? 'signup_error'}: ${error.message}`);
      return;
    }

    // Two possibilities:
    // 1) Email confirmation required: Supabase returns no active session.
    // 2) Confirmation disabled / "secure email change" off: session is returned immediately.
    const session = data?.session ?? null;

    if (!session) {
      setInfoMsg(
        'Check your email to confirm your account. You can sign in after confirming.'
      );
      return;
    }

    // Sync browser session to server cookies (so middleware sees it)
    try {
      const r = await fetch('/api/auth/set', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        }),
      });

      if (!r.ok) {
        let body: any = {};
        try {
          body = await r.json();
        } catch {}
        setErrorMsg(`cookie_sync_error: ${body?.error ?? r.statusText}`);
        return;
      }
    } catch (e: any) {
      setErrorMsg(`cookie_sync_network: ${e?.message || String(e)}`);
      return;
    }

    // Go to intended destination
    router.push(redirectedFrom);
  }

  const anyLoading = loading;

  return (
    <div className="flex justify-center mt-16 px-4">
      <form className="space-y-4 w-full max-w-sm" onSubmit={handleSubmit} aria-busy={anyLoading}>
        <h2 className="h2 text-center">Create your account</h2>

        {errorMsg ? (
          <p className="text-red-600 whitespace-pre-line rounded-md border border-red-200 bg-red-50 p-2 text-sm">
            {errorMsg}
          </p>
        ) : null}

        {infoMsg ? (
          <p className="text-green-700 whitespace-pre-line rounded-md border border-green-200 bg-green-50 p-2 text-sm">
            {infoMsg}
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
              placeholder="Create a strong password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input w-full pr-20"
              autoComplete="new-password"
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
          {loading ? 'Creating account…' : 'Sign Up'}
        </button>

        <p className="text-sm text-center">
          Already have an account?{' '}
          <Link
            href={`/sign-in?redirectedFrom=${encodeURIComponent(redirectedFrom)}`}
            className="link"
          >
            Sign in here
          </Link>
        </p>
      </form>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div />}>
      <SignUpInner />
    </Suspense>
  );
}
