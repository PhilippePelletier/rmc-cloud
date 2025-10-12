import Link from 'next/link';
import UserMenu from '@/components/UserMenu';
import { getServerSession } from '@/app/lib/supabase-server';

export default async function Header() {
  const { user } = await getServerSession();

  return (
    <header className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-base font-semibold">
            RMC Cloud
          </Link>
          <nav className="hidden gap-3 sm:flex">
            <Link href="/uploads" className="text-sm text-gray-600 hover:text-gray-900">
              Uploads
            </Link>
            <Link href="/jobs" className="text-sm text-gray-600 hover:text-gray-900">
              Jobs
            </Link>
          </nav>
        </div>
        <UserMenu user={user} />
      </div>
    </header>
  );
}
