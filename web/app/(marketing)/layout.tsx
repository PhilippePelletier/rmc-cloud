// app/(marketing)/layout.tsx
import '../globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'RMC Cloud – Retail Margin Copilot',
  description: 'Turn retail data into margin wins. Upload, map, brief—automatically.',
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Simple marketing header (separate from your app layout) */}
        <header className="border-b bg-white/80 backdrop-blur">
          <div className="container mx-auto flex items-center justify-between px-4 py-4">
            <Link href="/" className="flex items-center gap-2">
              <img src="/logo.svg" alt="RMC Cloud" className="h-6 w-6" />
              <span className="font-semibold">RMC Cloud</span>
            </Link>
            <nav className="flex items-center gap-3">
              <Link href="/sign-in" className="btn">Sign In</Link>
              <Link href="/sign-up" className="btn">Sign Up</Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="mt-12 border-t py-8 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} RMC Cloud — Retail Margin Copilot
        </footer>
      </body>
    </html>
  );
}
