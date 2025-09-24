import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supaService } from "../../lib/supabase";

export const dynamic = 'force-dynamic';

export async function GET() {
   const { userId, orgId } = auth();
  if (!userId) {
    return NextResponse.json({ error: 'Auth required' }, { status: 401 });
  }
  
  // Use the organization if present, otherwise fall back to the user ID.
  const groupId = orgId ?? userId;
  
  const supa = supaService();

  const { data, error } = await supa.from("jobs")
    .select("id, kind, status, message, created_at, updated_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data });
}
