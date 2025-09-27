// app/components/SupabaseProvider.tsx
'use client';

import { useMemo } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function SupabaseProvider({ children }: { children: React.ReactNode }) {
  // Create once on the client; if you don’t use it, it’s harmless
  const _supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  return <>{children}</>;
}
