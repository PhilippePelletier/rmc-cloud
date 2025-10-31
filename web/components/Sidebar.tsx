// web/components/Sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const APP_NAME = 'MarginHQ';
const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/uploads', label: 'Uploads' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/brief', label: 'Brief' },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-52 shrink-0 border-r bg-background px-4 py-6 md:block">
      <Link href="/" className="mb-6 block text-lg font-semibold">
        {APP_NAME}
      </Link>
      <nav className="flex flex-col gap-2">
        {NAV_ITEMS.map(({ href, label }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-md px-3 py-2 text-sm font-medium hover:bg-muted ${
                isActive ? 'bg-muted text-foreground' : 'text-muted-foreground'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
