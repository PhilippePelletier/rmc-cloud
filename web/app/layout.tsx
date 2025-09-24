// web/app/layout.tsx
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import ToasterClient from "../components/ToasterClient"; // make sure this file exists
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton
} from '@clerk/nextjs';


export const metadata = {
  title: "RMC Cloud",
  description: "Retail Margin Copilot (Cloud)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          {/* Toaster must render from a client component */}
          <ToasterClient />

          <div className="container py-6">
            <header className="mb-6 flex items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <a href="/" className="h1">RMC Cloud</a>
                <nav className="hidden md:flex items-center gap-2">
                  <a className="btn" href="/dashboard">Dashboard</a>
                  <a className="btn" href="/uploads">Uploads</a>
                  <a className="btn" href="/jobs">Jobs</a>
                  <a className="btn" href="/brief">Brief</a>
                  <SignedOut>
                    {/* When the user is signed out, show a sign‑in button.
                        The mode="modal" property opens Clerk’s sign‑in form as a modal. */}
                    <SignInButton mode="modal">
                      <button className="px-4 py-2 bg-blue-600 text-white rounded">
                        Sign in
                      </button>
                    </SignInButton>
                  </SignedOut>
                  
                  <SignedIn>
                    {/* When the user is signed in, show their profile button with sign‑out options. */}
                    <UserButton afterSignOutUrl="/sign-in" />
                  </SignedIn>
                </nav>
              </div>
              <div className="flex items-center gap-3">
                <OrganizationSwitcher />
                    <a className="btn" href="/create-organization">New Org</a>
                <UserButton />
              </div>
            </header>

            {children}
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}

