import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, UserButton, auth } from "@clerk/nextjs";

export default async function Home() {
  return (
    <main className="grid gap-4">
      <div className="card">
        <div className="flex justify-between items-center">
          <div className="h2">Welcome</div>
          <UserButton afterSignOutUrl="/"/>
        </div>
        <p className="mt-2">Upload POS CSVs and get dashboards + a weekly brief.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Link className="btn" href="/dashboard">Dashboard</Link>
          <Link className="btn" href="/brief">Weekly Brief</Link>
        </div>
      </div>
      <SignedOut><SignInButton /></SignedOut>
    </main>
  );
}
