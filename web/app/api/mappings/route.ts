// app/api/mappings/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { getApiContext } from "@/app/lib/api-ctx";

// GET /api/mappings?kind=sales
export async function GET(req: NextRequest) {
  const ctx = await getApiContext();
  if ("error" in ctx) return ctx.error;

  const { supabase, groupId } = ctx;

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind"); // optional filter

  let q = supabase.from("mappings").select("*").eq("group_id", groupId);
  if (kind) q = q.eq("kind", kind);

  const { data, error } = await q.order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ mappings: data ?? [] });
}

// POST /api/mappings  body: { kind: 'sales'|'product_master'|..., name: string, mapping: Record<string,string> }
export async function POST(req: NextRequest) {
  const ctx = await getApiContext();
  if ("error" in ctx) return ctx.error;

  const { supabase, groupId } = ctx;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { kind, name, mapping } = body as {
    kind?: string;
    name?: string;
    mapping?: Record<string, string>;
  };

  if (!kind || !name || !mapping || typeof mapping !== "object") {
    return NextResponse.json(
      { error: "Required fields: kind, name, mapping" },
      { status: 400 }
    );
  }

  // Insert mapping for this user. RLS enforces auth.uid() = group_id.
  const { data, error } = await supabase
    .from("mappings")
    .insert([
      {
        group_id: groupId,
        org_id: null, // reserved for future orgs
        kind,
        name,
        mapping,
      },
    ])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ mapping: data }, { status: 201 });
}

// PUT /api/mappings  body: { id: number, name?: string, mapping?: Record<string,string> }
export async function PUT(req: NextRequest) {
  const ctx = await getApiContext();
  if ("error" in ctx) return ctx.error;

  const { supabase, groupId } = ctx;
  const body = await req.json().catch(() => null);

  if (!body || typeof body !== "object" || !("id" in body)) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { id, name, mapping } = body as {
    id: number;
    name?: string;
    mapping?: Record<string, string>;
  };

  const update: Record<string, any> = {};
  if (name) update.name = name;
  if (mapping) update.mapping = mapping;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  // Update only rows owned by this user (group_id). RLS + where clause both enforce.
  const { data, error } = await supabase
    .from("mappings")
    .update(update)
    .eq("id", id)
    .eq("group_id", groupId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ mapping: data });
}

// DELETE /api/mappings?id=123
export async function DELETE(req: NextRequest) {
  const ctx = await getApiContext();
  if ("error" in ctx) return ctx.error;

  const { supabase, groupId } = ctx;
  const url = new URL(req.url);
  const idParam = url.searchParams.get("id");
  const id = idParam ? Number(idParam) : NaN;

  if (!idParam || Number.isNaN(id)) {
    return NextResponse.json({ error: "Missing or invalid id" }, { status: 400 });
  }

  // Delete only if it belongs to this user
  const { error } = await supabase
    .from("mappings")
    .delete()
    .eq("id", id)
    .eq("group_id", groupId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
