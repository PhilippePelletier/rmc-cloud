// app/layout.tsx
import './globals.css';
import ToasterClient from '@/components/ToasterClient';
import NavMenu from '@/components/NavMenu';
import SupabaseProvider from '@/components/SupabaseProvider';
import Link from 'next/link';

// NEW: server-side session helper + client user menu
import { getServerSession } from '@/app/lib/supabase-server';
import UserMenu from '@/components/UserMenu';

// NEW: header visibility wrapper (renders children or nothing based on route)
import HeaderShell from '@/components/HeaderShell';

export const metadata = {
  title: 'RMC Cloud',
  description: 'Retail Margin Copilot (Cloud)',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Fetch current user on the server (no flashing)
  const { user } = await getServerSession();

  return (
    <html lang="en">
      <body>
        <SupabaseProvider>
          <div className="container py-6">
            {/* Header is now wrapped by HeaderShell so it hides on / and /welcome */}
            <HeaderShell>
              <header className="mb-6 flex items-center justify-between gap-3">
                <NavMenu />
                <div className="flex items-center gap-3">
                  {user ? (
                    <UserMenu user={user} />
                  ) : (
                    <>
                      <Link className="btn" href="/sign-in">Sign In</Link>
                      <Link className="btn" href="/sign-up">Sign Up</Link>
                    </>
                  )}
                </div>
              </header>
            </HeaderShell>

            <ToasterClient />
            {children}
          </div>
        </SupabaseProvider>
      </body>
    </html>
  );
}
