// app/lib/supabase-rls.ts
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

export async function supaRls() {
  const { userId, getToken } = auth();
  if (!userId) throw new Error("Auth required");

  // Clerk → Supabase JWT (template name must match what you created in Clerk)
  const token = await getToken({ template: "supabase" });
  if (!token) throw new Error("Auth required: no Supabase token");

  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createClient(url, anon, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });
}
