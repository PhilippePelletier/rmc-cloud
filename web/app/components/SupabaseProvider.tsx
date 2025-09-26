// app/components/SupabaseProvider.tsx
'use client';

import { useState } from 'react';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase'; // optional if you have generated types

export default function SupabaseProvider({ children }: { children: React.ReactNode }) {
  // Create the client once on mount
  const [supabaseClient] = useState(() =>
    createClientComponentClient<Database>() // or omit <Database> if you don't have types
  );

  return (
    <SessionContextProvider supabaseClient={supabaseClient}>
      {children}
    </SessionContextProvider>
  );
}
