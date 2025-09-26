// web/app/page.tsx
import Link from 'next/link';

export default function Home() {
  return (
    <main className="grid gap-4">
      <div className="card">
        <div className="flex justify-between items-center">
          <h2 className="h2">Welcome</h2>
        </div>
        <p className="mt-2">Upload POS CSVs and get dashboards + a weekly brief.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Link className="btn" href="/dashboard">Dashboard</Link>
          <Link className="btn" href="/brief">Weekly Brief</Link>
        </div>
      </div>

      {/* If not signed in, prompt to sign in or up */}
      <div className="text-center">
        <Link className="btn" href="/sign-in">Sign In</Link>
        <Link className="btn ml-2" href="/sign-up">Sign Up</Link>
      </div>
    </main>
  );
}
