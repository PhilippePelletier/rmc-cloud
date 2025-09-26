// web/app/layout.tsx
import './globals.css';
import ToasterClient from '@/components/ToasterClient';
import NavMenu from '@/components/NavMenu';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';

export const metadata = {
  title: 'RMC Cloud',
  description: 'Retail Margin Copilot (Cloud)',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Initialize Supabase client (will use cookies for auth)
  const supabase = createBrowserClient();

  return (
    <SessionContextProvider supabaseClient={supabase}>
      <html lang="en">
        <body>
          {/* Toast notifications */}
          <ToasterClient />

          <div className="container py-6">
            <header className="mb-6 flex items-center justify-between gap-3">
              {/* Logo and navigation */}
              <NavMenu />

              {/* Right side: Sign-in/Sign-out links */}
              <div className="flex items-center gap-3">
                {/* For simplicity, always show sign-in/sign-up.
                    (You could use a client hook to show a sign-out when session exists.) */}
                <Link className="btn" href="/sign-in">Sign In</Link>
                <Link className="btn" href="/sign-up">Sign Up</Link>
              </div>
            </header>

            {/* Main content */}
            {children}
          </div>
        </body>
      </html>
    </SessionContextProvider>
  );
}



