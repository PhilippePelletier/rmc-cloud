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
  const [loading, setLoading] = useState(false);

  async function handlePasswordSignIn(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setErrorMsg(`${error.code ?? 'auth_error'}: ${error.message}`);
      return;
    }
    if (!data.session) {
      setErrorMsg('No session returned. Check email confirmation settings in Supabase Auth.');
      return;
    }
    router.push(redirectedFrom);
  }

  async function handleOAuth(provider: 'google' | 'linkedin_oidc') {
    setErrorMsg('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + '/dashboard' },
    });
    if (error) setErrorMsg(`${error.code ?? 'oauth_error'}: ${error.message}`);
  }

  async function handleMagicLink() {
    setErrorMsg('');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + '/dashboard' },
    });
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

        <button type="submit" className="btn w-full" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>

        <div className="text-center text-sm mt-2">or</div>

        <button type="button" className="btn w-full" onClick={() => handleOAuth('google')}>
          Continue with Google
        </button>
        <button type="button" className="btn w-full" onClick={() => handleOAuth('linkedin_oidc')}>
          Continue with LinkedIn
        </button>

        <div className="border-t pt-3 text-sm">
          <button type="button" className="link" onClick={handleMagicLink}>
            Send me a magic link instead
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
