import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/app/lib/api-ctx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/mappings?kind=<kind>  - List saved mappings for current group (optionally filter by kind)
export async function GET(req: NextRequest) {
  const ctx = await getApiContext();
  if ("error" in ctx) return ctx.error;
  const { supabase, groupId } = ctx;
  const { searchParams } = new URL(req.url);
  const kindFilter = searchParams.get("kind") || undefined;

  // Fetch mappings for this group (and kind if provided)
  let query = supabase.from("mappings")
    .select("id, name, kind, mapping")
    .eq("group_id", groupId);
  if (kindFilter) {
    query = query.eq("kind", kindFilter);
  }
  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ mappings: data ?? [] });
}

// POST /api/mappings  - Create or update a mapping
export async function POST(req: NextRequest) {
  const ctx = await getApiContext();
  if ("error" in ctx) return ctx.error;
  const { supabase, groupId, groupType } = ctx;
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { name, kind, mapping } = body;
  if (!name || !kind || !mapping) {
    return NextResponse.json({ error: "Missing name, kind, or mapping data" }, { status: 400 });
  }

  // Determine org_id if applicable (for consistency with jobs table)
  const orgId = groupType === 'org' ? groupId : null;
  // Check if a mapping with this name (in this group and kind) already exists
  const { data: existing, error: fetchError } = await supabase
    .from("mappings")
    .select("id")
    .eq("group_id", groupId)
    .eq("kind", kind)
    .eq("name", name)
    .single();
  if (fetchError && fetchError.code !== "PGRST116") { 
    // PGRST116 = No rows (not found); we ignore that as it's not an error for our logic
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  let dbError;
  if (existing) {
    // Update existing mapping
    const { error } = await supabase.from("mappings")
      .update({ mapping })
      .eq("id", existing.id);
    dbError = error;
  } else {
    // Insert new mapping
    const { error } = await supabase.from("mappings")
      .insert({ group_id: groupId, org_id: orgId, kind, name, mapping });
    dbError = error;
  }
  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }
  return NextResponse.json({ status: "ok" });
}

// DELETE /api/mappings?id=<id>  - Remove a saved mapping
export async function DELETE(req: NextRequest) {
  const ctx = await getApiContext();
  if ("error" in ctx) return ctx.error;
  const { supabase, groupId } = ctx;
  const { searchParams } = new URL(req.url);
  const idParam = searchParams.get("id");
  if (!idParam) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const mappingId = isNaN(Number(idParam)) ? idParam : Number(idParam);  // handle numeric or UUID id
  const { error } = await supabase.from("mappings")
    .delete()
    .eq("id", mappingId)
    .eq("group_id", groupId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ status: "ok" });
}
