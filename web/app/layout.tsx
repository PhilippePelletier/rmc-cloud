// app/layout.tsx
import './globals.css';
import ToasterClient from '@/components/ToasterClient';
import SupabaseProvider from '@/components/SupabaseProvider';
import Link from 'next/link';
import { getServerSession } from '@/app/lib/supabase-server';
import UserMenu from '@/components/UserMenu';
import HeaderShell from '@/components/HeaderShell';
import Sidebar from '@/components/Sidebar';

export const metadata = {
  title: 'MarginHQ',
  description: 'MarginHQ — Finance-grade retail analytics',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await getServerSession();
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">
        <SupabaseProvider>
          <div className="flex min-h-screen">
            {/* Persistent side navigation */}
            <Sidebar />
            <div className="flex flex-1 flex-col">
              {/* Sticky top bar – now slightly taller and dark blue */}
              <HeaderShell>
                <header className="sticky top-0 z-50 flex items-center justify-end gap-4 border-b border-blue-800 bg-blue-950 px-5 py-3 text-white">
                  {user ? (
                    <UserMenu user={user} />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Link
                        className="rounded-md bg-blue-800 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
                        href="/sign-in"
                      >
                        Sign In
                      </Link>
                      <Link
                        className="rounded-md bg-blue-800 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
                        href="/sign-up"
                      >
                        Sign Up
                      </Link>
                    </div>
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
