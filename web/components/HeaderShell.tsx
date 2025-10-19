// web/components/HeaderShell.tsx
'use client';

import { usePathname } from 'next/navigation';

export default function HeaderShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Hide header on the marketing landing page
  if (pathname === '/welcome') return null;
  return <>{children}</>;
}
