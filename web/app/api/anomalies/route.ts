import { NextResponse } from "next/server";
import { supaRls } from "@/app/lib/supabase-rls";
import { getCurrentGroupId } from "@/app/lib/group";

export const dynamic = 'force-dynamic';

interface DailyAggRow {
  date: string;
  category: string | null;
  net_sales: number | null;
}

export async function GET() {
  try {
    // 1) Compute the group id (org uuid string OR user id)
    const groupId = await getCurrentGroupId();

    // 2) Use the RLS client so Supabase enforces our policies
    const supa = await supaRls();

    // 3) Always filter by group_id (TEXT), never org_id
    const { data, error } = await supa
      .from("daily_agg")
      .select("date, category, net_sales")
      .eq("group_id", groupId)
      .order("date", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 4) Compute anomalies (unchanged)
    const grouped: Record<string, { dates: string[]; values: number[] }> = {};
    for (const row of (data as DailyAggRow[]) || []) {
      const cat = row.category ?? "Uncategorized";
      grouped[cat] ??= { dates: [], values: [] };
      grouped[cat].dates.push(row.date);
      grouped[cat].values.push(Number(row.net_sales || 0));
    }

    const anomalies: Array<{ date: string; category: string; revenue: number; delta_pct: number }> = [];
    for (const [cat, { dates, values }] of Object.entries(grouped)) {
      const n = values.length || 1;
      const mean = values.reduce((a, v) => a + v, 0) / n;
      const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / n;
      const std = Math.sqrt(variance);

      values.forEach((v, idx) => {
        if (std > 0 && Math.abs(v - mean) > 2 * std) {
          anomalies.push({
            date: dates[idx],
            category: cat,
            revenue: v,
            delta_pct: mean ? ((v - mean) / mean) * 100 : 0,
          });
        }
      });
    }

    return NextResponse.json({ anomalies });
  } catch (e: any) {
    const msg = typeof e?.message === 'string' ? e.message : 'Unexpected error';
    return NextResponse.json({ error: msg }, { status: msg === 'Auth required' ? 401 : 500 });
  }
}
