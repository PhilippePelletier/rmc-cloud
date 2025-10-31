'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  Home,
  UploadCloud,
  Briefcase,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const APP_NAME = 'MarginHQ';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/uploads', label: 'Uploads', icon: UploadCloud },
  { href: '/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/brief', label: 'Brief', icon: ClipboardList },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  return (
    <aside
      className={`hidden md:flex flex-col ${
        collapsed ? 'w-16' : 'w-56'
      } shrink-0 border-r border-gray-800 bg-gray-900 text-gray-300 transition-all duration-200`}
    >
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800">
        <span
          className={`app-title inline-flex items-center justify-center rounded-md border border-gray-700 px-2 py-1 ${
            collapsed ? 'text-sm tracking-wide' : 'text-lg font-bold tracking-wider'
          }`}
        >
          {collapsed ? 'MHQ' : APP_NAME}
        </span>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded p-1 hover:bg-gray-800"
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>
      <nav className="flex flex-col divide-y divide-gray-800 mt-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon size={20} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
