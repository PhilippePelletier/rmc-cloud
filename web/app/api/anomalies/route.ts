// web/app/api/anomalies/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supaService } from "../../lib/supabase";

export const dynamic = 'force-dynamic';

interface DailyAggRow {
  date: string;
  category: string | null;
  net_sales: number | null;
}

export async function GET() {
  const { userId, orgId } = auth();
  if (!userId) {
    return NextResponse.json({ error: 'Auth required' }, { status: 401 });
  }
  
  // Use the organization if present, otherwise fall back to the user ID.
  const groupId = orgId ?? userId;

const supa = supaService();

  const { data, error } = await supa
    .from("daily_agg")
    .select("date, category, net_sales")
    .eq("org_id", groupId)
    .order("date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group data by category
  const grouped: Record<string, { dates: string[]; values: number[] }> = {};
  for (const row of (data as DailyAggRow[]) || []) {
    const cat = row.category ?? "Uncategorized";
    grouped[cat] ??= { dates: [], values: [] };
    grouped[cat].dates.push(row.date);
    grouped[cat].values.push(Number(row.net_sales || 0));
  }

  const anomalies: Array<{ date: string; category: string; revenue: number; delta_pct: number }> = [];
  for (const [cat, { dates, values }] of Object.entries(grouped)) {
    const n    = values.length;
    const mean = values.reduce((a, v) => a + v, 0) / n;
    const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / n;
    const std  = Math.sqrt(variance);

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
}
