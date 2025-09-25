import { NextResponse } from "next/server";
import { getApiContext } from "@/app/lib/api-ctx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // 1) Get Supabase client and group context
  const ctx = await getApiContext();
  if ("error" in ctx) return ctx.error;
  const { supabase, groupId } = ctx;

  // 2) Query the latest brief for this workspace
  const { data, error } = await supabase
    .from("briefs")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  // 3) If a PDF path exists, create a signed URL for download
  let pdf_url: string | null = null;
  if (data.pdf_path) {
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: link, error: linkErr } = await supabaseAdmin.storage
      .from("rmc-briefs")
      .createSignedUrl(data.pdf_path, 60 * 10);
    if (!linkErr) {
      pdf_url = link?.signedUrl ?? null;
    }
  }

  return NextResponse.json({ ...data, pdf_url });
}
