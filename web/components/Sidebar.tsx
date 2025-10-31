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
    <aside className="hidden md:block w-56 shrink-0 bg-blue-950 text-gray-200">
      <div className="px-4 py-6">
        <Link
          href="/"
          className="mb-8 block text-xl font-bold tracking-wide text-gray-100 hover:text-white"
        >
          {APP_NAME}
        </Link>
        <nav className="flex flex-col divide-y divide-blue-800">
          {NAV_ITEMS.map(({ href, label }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`py-3 px-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-900 text-white'
                    : 'text-gray-400 hover:bg-blue-900 hover:text-white'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
