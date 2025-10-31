// app/layout.tsx (modified)
import './globals.css';
import ToasterClient from '@/components/ToasterClient';
import SupabaseProvider from '@/components/SupabaseProvider';
import Link from 'next/link';
import { getServerSession } from '@/app/lib/supabase-server';
import UserMenu from '@/components/UserMenu';
import HeaderShell from '@/components/HeaderShell';
import Sidebar from '@/components/Sidebar';

// Updated metadata for new brand
export const metadata = {
  title: 'MarginHQ',
  description: 'MarginHQ — Finance-grade retail analytics',
};

export default async function RootLayout({ children }) {
  const { user } = await getServerSession();
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">
        <SupabaseProvider>
          <div className="flex min-h-screen">
            {/* Persistent side navigation */}
            <Sidebar />
            <div className="flex flex-1 flex-col">
              {/* Sticky top bar for user actions */}
              <HeaderShell>
                <header className="sticky top-0 z-50 flex items-center justify-end gap-3 border-b bg-background/80 backdrop-blur px-4 py-2">
                  {user ? (
                    <UserMenu user={user} />
                  ) : (
                    <>
                      <Link className="btn" href="/sign-in">
                        Sign In
                      </Link>
                      <Link className="btn" href="/sign-up">
                        Sign Up
                      </Link>
                    </>
                  )}
                </header>
              </HeaderShell>
              <main className="flex-1 container mx-auto px-4 py-6">
                <ToasterClient />
                {children}
              </main>
            </div>
          </div>
        </SupabaseProvider>
      </body>
    </html>
  );
}
