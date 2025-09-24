// web/app/api/briefs/route.ts
import { NextResponse } from "next/server";
import { supaRls } from "@/app/lib/supabase-rls";     // NEW: RLS client (uses Clerk JWT template "supabase")
import { getCurrentGroupId } from "@/app/lib/group";  // NEW: returns org UUID string if org selected, else userId
import { createClient } from "@supabase/supabase-js"; // for storage signed URL with service key

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1) Resolve the “workspace” (org uuid as string OR user id)
    const groupId = await getCurrentGroupId();

    // 2) DB reads via RLS client (enforces policies)
    const supa = await supaRls();

    // 3) Always filter by group_id (TEXT) — never org_id here
    const { data, error } = await supa
      .from("briefs")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    // 4) Storage signed URLs: use a SERVICE client (storage has its own policies)
    let pdf_url: string | null = null;
    if (data?.pdf_path) {
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY! // server-only
      );
      const { data: link, error: linkErr } = await admin
        .storage
        .from("rmc-briefs")
        .createSignedUrl(data.pdf_path, 60 * 10);

      if (!linkErr) pdf_url = link?.signedUrl ?? null;
    }

    return NextResponse.json({ ...data, pdf_url });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Unexpected error";
    const code = /auth required/i.test(msg) ? 401 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}
