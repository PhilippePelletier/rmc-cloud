import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { job_id, folder_id } = await req.json(); // folder_id can be null to unfile
    if (!job_id) return NextResponse.json({ error: "Missing job_id" }, { status: 400 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from("jobs")
      .update({ folder_id: folder_id ?? null })
      .eq("id", job_id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to move job" }, { status: 500 });
  }
}
