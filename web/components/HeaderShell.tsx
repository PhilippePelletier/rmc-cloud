// components/HeaderShell.tsx
'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

/**
 * HeaderShell hides its children on public marketing routes.
 * Use it to wrap your <header> to avoid showing nav on landing pages.
 */
export default function HeaderShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideHeader = pathname === '/' || pathname === '/welcome';
  if (hideHeader) return null;
  return <>{children}</>;
}
