// web/app/page.tsx
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export default async function Home() {
  const store = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) { return store.get(name)?.value; },
        set() {},
        remove() {},
      },
    }
  );
  const { data } = await supabase.auth.getUser();

  if (data?.user) redirect('/dashboard');
  redirect('/sign-in'); // or a marketing/landing page if you add one
}
