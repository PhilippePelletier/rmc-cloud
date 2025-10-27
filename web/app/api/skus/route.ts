// app/api/skus/route.ts (new file)
import { NextResponse, NextRequest } from 'next/server';
import { getApiContext } from '@/app/lib/api-ctx';

export async function GET(req: NextRequest) {
  const ctx = await getApiContext();
  if ('error' in ctx) return ctx.error;
  const { supabase, groupId } = ctx;
  const { data, error } = await supabase
    .from('products')                      // use product master table
    .select('sku') 
    .eq('group_id', groupId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const skuSet = new Set<string>();
  for (const row of data ?? []) {
    const sku = row.sku ?? 'Unknown';
    skuSet.add(sku);
  }
  const skus = Array.from(skuSet).sort();
  return NextResponse.json({ skus });
}
