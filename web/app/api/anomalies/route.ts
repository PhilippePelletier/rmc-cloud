// web/app/api/anomalies/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supaService } from "../../lib/supabase";
import dayjs from "dayjs";

export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId, orgId } = auth();
  if (!userId || !orgId)
    return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const supa = supaService();
  const { data, error } = await supa
    .from("daily_agg")
    .select("date, category, net_sales")
    .eq("org_id", orgId)
    .order("date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Simple rolling mean and std deviation to find anomalies
  const anomalies: Array<{ date: string; category: string; revenue: number; delta_pct: number }> = [];
  const byCat: Record<string, { values: number[]; dates: string[] }> = {};

  for (const row of data || []) {
    const cat = row.category || "Uncategorized";
    byCat[cat] ??= { values: [], dates: [] };
    byCat[cat].values.push(Number(row.net_sales || 0));
    byCat[cat].dates.push(row.date);
  }

  for (const [category, { values, dates }] of Object.entries(byCat)) {
    const n = values.length;
    const mean = values.reduce((a, v) => a + v, 0) / n;
    const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / n;
    const std = Math.sqrt(variance);

    values.forEach((v, i) => {
      if (std > 0 && Math.abs(v - mean) / std > 2) { // simple 2-sigma rule
        anomalies.push({
          date: dates[i],
          category,
          revenue: v,
          delta_pct: std ? ((v - mean) / mean) * 100 : 0,
        });
      }
    });
  }

  return NextResponse.json({ anomalies });
}
