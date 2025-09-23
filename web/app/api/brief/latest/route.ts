import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supaService } from "../../../lib/supabase";

export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId, orgId } = auth();
  if (!userId || !orgId) return NextResponse.json({ error: "Auth required" }, { status: 401 });
  const supa = supaService();
  const { data, error } = await supa.from("briefs").select("*").eq("org_id", orgId).order("created_at", { ascending: false }).limit(1).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  // get signed URL for pdf if stored
  let pdf_url = null;
  if (data.pdf_path) {
    const { data: link } = await supa.storage.from("rmc-briefs").createSignedUrl(data.pdf_path, 60*10);
    pdf_url = link?.signedUrl || null;
  }
  return NextResponse.json({ ...data, pdf_url });
}
