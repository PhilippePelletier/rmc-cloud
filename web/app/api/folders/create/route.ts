import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { name, group_id } = await req.json();
    if (!name || !group_id) {
      return NextResponse.json({ error: "Missing name or group_id" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from("job_folders")
      .insert({ name, group_id })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ folder: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create folder" }, { status: 500 });
  }
}
