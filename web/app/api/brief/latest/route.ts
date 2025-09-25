// app/api/briefs/route.ts
import { NextResponse } from "next/server";
import { getApiContext } from "@/app/lib/api-ctx";

// Ensure Node runtime (Storage signed URLs need Node, not Edge)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // 1) Resolve auth + group + RLS client in one place
  const ctx = await getApiContext();
  if ("error" in ctx) return ctx.error;
  const { supa, groupId } = ctx;

  // 2) Read the latest brief for this tenant (user or org)
  const { data, error } = await supa
    .from("briefs")
    .select("*")
    .eq("group_id", groupId)       // <— key change: scope by group_id (TEXT)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  // 3) If there’s a PDF in Storage, mint a signed URL with a SERVICE client
  let pdf_url: string | null = null;
  if (data?.pdf_path) {
    // Create a short-lived service client on the server only
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!  // server-only secret
    );

    const { data: link, error: linkErr } = await admin
      .storage
      .from("rmc-briefs")
      .createSignedUrl(data.pdf_path, 60 * 10);

    if (!linkErr) pdf_url = link?.signedUrl ?? null;
  }

  return NextResponse.json({ ...data, pdf_url });
}
