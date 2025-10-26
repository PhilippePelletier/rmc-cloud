// web/app/api/stores/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { getApiContext } from '@/app/lib/api-ctx';

export async function GET(req: NextRequest) {
  const ctx = await getApiContext();
  if ('error' in ctx) return ctx.error;
  const { supabase, groupId } = ctx;
  const { data, error } = await supabase
    .from('stores')
    .select('store_id, store_name')
    .eq('group_id', groupId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // Ensure unique stores (no duplicates)
  const rows = data ?? [];
  const unique: Record<string, string | null> = {};
  for (const row of rows) {
    const id = String(row.store_id);
    // If duplicate ID exists, prefer the one with a name
    if (!(id in unique) || (!unique[id] && row.store_name)) {
      unique[id] = row.store_name;
    }
  }
  // Prepare sorted unique store list
  const stores = Object.entries(unique)
    .sort(([idA], [idB]) => idA.localeCompare(idB, undefined, { numeric: true }))
    .map(([id, name]) => ({ id, name }));
  return NextResponse.json({ stores });
}
