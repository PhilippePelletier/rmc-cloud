import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata = { title: "RMC Cloud", description: "Retail Margin Copilot (Cloud)" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en"><body><div className="container py-6">
        <header className="flex items-center justify-between mb-6">
          <h1 className="h1">RMC Cloud</h1>
          <a className="btn" href="/uploads">Uploads</a>
        </header>
        {children}
      </div></body></html>
    </ClerkProvider>
  );
}
