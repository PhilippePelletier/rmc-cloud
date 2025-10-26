// web/app/api/categories/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { getApiContext } from '@/app/lib/api-ctx';

export async function GET(req: NextRequest) {
  const ctx = await getApiContext();
  if ('error' in ctx) return ctx.error;
  const { supabase, groupId } = ctx;
  const { data, error } = await supabase
    .from('daily_agg')
    .select('category')
    .eq('group_id', groupId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const rows = data ?? [];
  const categoriesSet = new Set<string>();
  for (const row of rows) {
    const cat = row.category ?? 'Uncategorized';
    categoriesSet.add(cat);
  }
  // Convert to array and sort
  const categories = Array.from(categoriesSet).sort();
  return NextResponse.json({ categories });
}
