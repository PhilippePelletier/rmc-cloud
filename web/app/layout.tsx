import './globals.css';
import ToasterClient from '@/components/ToasterClient';
import { ClerkProvider, OrganizationSwitcher, UserButton, SignedIn, SignedOut, SignInButton } from '@clerk/nextjs';
import NavMenu from '@/components/NavMenu';

export const metadata = {
  title: "RMC Cloud",
  description: "Retail Margin Copilot (Cloud)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          {/* Toast notifications */}
          <ToasterClient />
          <div className="container py-6">
            <header className="mb-6 flex items-center justify-between gap-3">
              {/* Left side: Logo and nav links (NavMenu handles mobile toggle) */}
              <NavMenu />
              {/* Right side: Org switcher, New Org, and profile or sign-in */}
              <div className="flex items-center gap-3">
                <SignedIn>
                  <OrganizationSwitcher />
                  <a className="btn" href="/create-organization">New Org</a>
                  <UserButton afterSignOutUrl="/sign-in" />
                </SignedIn>
                <SignedOut>
                  <SignInButton mode="modal">
                    <button className="btn px-4 py-2 bg-blue-600 text-white rounded">
                      Sign in
                    </button>
                  </SignInButton>
                </SignedOut>
              </div>
            </header>
            {children}
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}


