// web/app/sign-up/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setErrorMsg(error.message);
    } else {
      // After sign-up, optionally auto-login or redirect
      router.push('/dashboard');
    }
  };

  return (
    <div className="flex justify-center mt-20">
      <form className="space-y-4 w-full max-w-sm" onSubmit={handleSubmit}>
        <h2 className="h2">Sign Up</h2>
        {errorMsg && <p className="text-red-600">{errorMsg}</p>}
        <input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="input w-full"
        />
        <input
          type="password"
          placeholder="Password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="input w-full"
        />
        <button type="submit" className="btn w-full">Sign Up</button>
        <p className="text-sm text-center">
          Already have an account? <a href="/sign-in" className="link">Sign in here</a>
        </p>
      </form>
    </div>
  );
}
