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
  const stores = (data ?? []).map(row => ({
    id: row.store_id,
    name: row.store_name,
  }));
  return NextResponse.json({ stores });
}
