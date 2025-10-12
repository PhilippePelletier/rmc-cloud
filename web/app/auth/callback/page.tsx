// app/auth/callback/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

export default function AuthCallback() {
  const params = useSearchParams();
  const next = params.get('next') || '/dashboard';
  const [msg, setMsg] = useState('Finishing sign-in…');

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  useEffect(() => {
    (async () => {
      try {
        // After the redirect, Supabase should have a session in the browser.
        const { data: sess, error } = await supabase.auth.getSession();
        if (error) throw error;

        const at = sess?.session?.access_token;
        const rt = sess?.session?.refresh_token;
        if (!at || !rt) {
          setMsg('No session found. Try signing in again.');
          return;
        }

        // Sync to server cookies so middleware/server components see you as authed
        const r = await fetch('/api/auth/set', {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ access_token: at, refresh_token: rt }),
        });

        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          setMsg(`cookie_sync_error: ${body?.error ?? r.statusText}`);
          return;
        }

        // Hard navigate so the whole app re-renders as authenticated
        window.location.assign(next);
      } catch (e: any) {
        setMsg(e?.message || 'Unexpected error');
      }
    })();
  }, [supabase, next]);

  return (
    <main className="container py-10">
      <p className="text-sm text-gray-600">{msg}</p>
    </main>
  );
}
