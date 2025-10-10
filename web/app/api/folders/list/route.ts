import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const group_id = searchParams.get("group_id");
    if (!group_id) {
      return NextResponse.json({ error: "Missing group_id" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from("job_folders")
      .select("*")
      .eq("group_id", group_id)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ folders: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to list folders" }, { status: 500 });
  }
}
