// web/app/create-organization/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CreateOrgPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setErrorMsg('Not authenticated');
      return;
    }
    // Insert new org; we assume `owner_id` column exists
    const { error } = await supabase.from('orgs').insert({ name, owner_id: user.id });
    if (error) {
      setErrorMsg(error.message);
    } else {
      setSuccessMsg('Organization created');
      // You might want to do additional steps (e.g. set a cookie for org context)
      // For now, just go home or refresh
      router.push('/');
    }
  };

  return (
    <main className="container py-6">
      <h2 className="h2 mb-4">Create Organization</h2>
      {errorMsg && <p className="text-red-600">{errorMsg}</p>}
      {successMsg && <p className="text-green-600">{successMsg}</p>}
      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        <input
          type="text"
          placeholder="Organization Name"
          required
          value={name}
          onChange={e => setName(e.target.value)}
          className="input w-full"
        />
        <button type="submit" className="btn">Create Org</button>
      </form>
    </main>
  );
}
