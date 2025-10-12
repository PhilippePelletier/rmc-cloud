'use client';

import { useEffect, useRef, useState } from 'react';
import { createSupabaseBrowser } from '@/app/lib/supabase-browser';
import Link from 'next/link';

type Props = {
  user:
    | {
        email?: string | null;
        user_metadata?: { avatar_url?: string; name?: string };
      }
    | null;
};

export default function UserMenu({ user }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const sb = createSupabaseBrowser();

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const avatar =
    user?.user_metadata?.avatar_url ||
    `https://api.dicebear.com/8.x/identicon/svg?seed=${encodeURIComponent(
      user?.email || 'user'
    )}`;

  async function signOut() {
    await sb.auth.signOut();
    window.location.href = '/signin';
  }

  if (!user) {
    return (
      <Link
        href="/signin"
        className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border px-2 py-1 hover:bg-gray-50"
      >
        <span className="relative block h-6 w-6 overflow-hidden rounded-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatar} alt="avatar" className="h-full w-full object-cover" />
        </span>
        <span className="hidden text-sm text-gray-700 sm:block">
          {user?.user_metadata?.name || user?.email}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-lg border bg-white shadow-lg">
          <div className="px-3 py-2 text-xs text-gray-500">
            Signed in as
            <div className="truncate font-medium text-gray-800">
              {user?.user_metadata?.name || user?.email}
            </div>
          </div>
          <div className="my-1 h-px bg-gray-100" />
          <a href="/uploads" className="block px-3 py-2 text-sm hover:bg-gray-50">
            Uploads
          </a>
          <a href="/jobs" className="block px-3 py-2 text-sm hover:bg-gray-50">
            Jobs
          </a>
          <div className="my-1 h-px bg-gray-100" />
          <button
            type="button"
            onClick={signOut}
            className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-50"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
