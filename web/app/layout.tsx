// app/layout.tsx
import './globals.css';
import ToasterClient from '@/components/ToasterClient';
import NavMenu from '@/components/NavMenu';
import SupabaseProvider from '@/components/SupabaseProvider';
import Link from 'next/link';

export const metadata = {
  title: 'RMC Cloud',
  description: 'Retail Margin Copilot (Cloud)',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SupabaseProvider>
          <div className="container py-6">
            <header className="mb-6 flex items-center justify-between gap-3">
              <NavMenu />
              <div className="flex items-center gap-3">
                <Link className="btn" href="/sign-in">Sign In</Link>
                <Link className="btn" href="/sign-up">Sign Up</Link>
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




