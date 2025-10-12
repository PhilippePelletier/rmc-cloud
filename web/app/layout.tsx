// app/layout.tsx
import './globals.css';
import ToasterClient from '@/components/ToasterClient';
import NavMenu from '@/components/NavMenu';
import SupabaseProvider from '@/components/SupabaseProvider';
import UserMenu from '@/components/UserMenu';
import { getServerSession } from '@/app/lib/supabase-server';
import Link from 'next/link';

export const metadata = {
  title: 'RMC Cloud',
  description: 'Retail Margin Copilot (Cloud)',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Server-side: check session so header can render the correct auth UI
  const { user } = await getServerSession();

  return (
    <html lang="en">
      <body>
        <SupabaseProvider>
          <div className="container py-6">
            <header className="mb-6 flex items-center justify-between gap-3">
              <NavMenu />
              <div className="flex items-center gap-3">
                {user ? (
                  // Logged-in: compact user menu with avatar + sign out
                  /* @ts-expect-error Server/Client boundary is OK */
                  <UserMenu user={user} />
                ) : (
                  // Logged-out: keep your existing buttons
                  <>
                    <Link className="btn" href="/sign-in">Sign In</Link>
                    <Link className="btn" href="/sign-up">Sign Up</Link>
                  </>
                )}
              </div>
            </header>
            <ToasterClient />
            {children}
          </div>
        </SupabaseProvider>
      </body>
    </html>
  );
}



