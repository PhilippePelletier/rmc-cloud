'use client';
import { useState } from 'react';
import { SignedIn } from '@clerk/nextjs';

export default function NavMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-4">
      <a href="/" className="h1">RMC Cloud</a>
      <SignedIn>
        {/* Mobile menu toggle button (visible on small screens) */}
        <button
          className="md:hidden btn px-3 py-2"
          onClick={() => setOpen(!open)}
          aria-label="Toggle navigation menu"
        >
          ☰
        </button>
        {/* Navigation links (shown if signed in) */}
        <nav
          className={`${open ? 'flex flex-col space-y-2' : 'hidden'} md:flex md:flex-row md:space-y-0 items-center gap-2`}
        >
          <a className="btn" href="/dashboard">Dashboard</a>
          <a className="btn" href="/uploads">Uploads</a>
          <a className="btn" href="/jobs">Jobs</a>
          <a className="btn" href="/brief">Brief</a>
        </nav>
      </SignedIn>
    </div>
  );
}
