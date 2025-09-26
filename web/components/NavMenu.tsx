// web/components/NavMenu.tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function NavMenu() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-4">
      <Link href="/" className="h1">RMC Cloud</Link>
      {/* Mobile menu toggle */}
      <button
        className="md:hidden btn px-3 py-2"
        onClick={() => setOpen(!open)}
        aria-label="Toggle navigation menu"
      >
        ☰
      </button>
      {/* Navigation links */}
      <nav className={`${open ? 'flex flex-col' : 'hidden'} md:flex md:flex-row items-center gap-2`}>
        <Link className="btn" href="/dashboard">Dashboard</Link>
        <Link className="btn" href="/uploads">Uploads</Link>
        <Link className="btn" href="/jobs">Jobs</Link>
        <Link className="btn" href="/brief">Brief</Link>
      </nav>
    </div>
  );
}
