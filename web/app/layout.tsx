import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { OrganizationSwitcher, CreateOrganization, UserButton } from "@clerk/nextjs";
import { Toaster } from "react-hot-toast";

export const metadata = { title: "RMC Cloud", description: "Retail Margin Copilot (Cloud)" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <Toaster position="top-right" />
          <div className="container py-6">
            <header className="mb-6 flex items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <a href="/" className="h1">RMC Cloud</a>
                <nav className="hidden md:flex items-center gap-2">
                  <a className="btn" href="/dashboard">Dashboard</a>
                  <a className="btn" href="/uploads">Uploads</a>
                  <a className="btn" href="/jobs">Jobs</a>
                  <a className="btn" href="/brief">Brief</a>
                </nav>
              </div>
              <div className="flex items-center gap-3">
                <OrganizationSwitcher />
                <CreateOrganization>
                  <button className="btn">New Org</button>
                </CreateOrganization>
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

