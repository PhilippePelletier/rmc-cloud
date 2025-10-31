import './globals.css';
import type { ReactNode } from 'react';
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

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { user } = await getServerSession();
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-gray-100">
        <SupabaseProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex flex-1 flex-col">
              <HeaderShell>
                <header className="sticky top-0 z-50 flex items-center justify-end gap-4 border-b border-gray-800 bg-gray-950 px-5 py-4">
                  {user ? (
                    <UserMenu user={user} />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Link
                        href="/sign-in"
                        className="rounded-md bg-gray-900 px-3 py-1.5 text-sm text-gray-100 hover:bg-gray-800"
                      >
                        Sign In
                      </Link>
                      <Link
                        href="/sign-up"
                        className="rounded-md bg-gray-900 px-3 py-1.5 text-sm text-gray-100 hover:bg-gray-800"
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
