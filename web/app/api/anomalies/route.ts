import { NextResponse } from "next/server";
import { getApiContext } from "@/app/lib/api-ctx";

export const dynamic = "force-dynamic";

type Anomaly = { date: string; category: string; revenue: number; delta_pct: number };

export async function GET() {
  // Auth + Supabase client + workspace context
  const ctx = await getApiContext();
  if ("error" in ctx) return ctx.error;
  const { supabase, groupId } = ctx;

  // Query recent daily aggregates for this workspace (last ~90 days)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);
  const cutoffStr = cutoffDate.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("daily_agg")
    .select("date, category, net_sales")
    .eq("group_id", groupId)
    .gte("date", cutoffStr)
    .order("date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group data by category and perform anomaly detection (2σ rule)
  const anomalies: Anomaly[] = [];
  const grouped: Record<string, { dates: string[]; values: number[] }> = {};
  for (const row of data ?? []) {
    const cat = row.category ?? "Uncategorized";
    const value = Number(row.net_sales ?? 0);
    (grouped[cat] ??= { dates: [], values: [] }).dates.push(row.date);
    grouped[cat].values.push(value);
  }
  for (const [cat, { dates, values }] of Object.entries(grouped)) {
    if (values.length < 4) continue; // need at least a few points
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    const std = Math.sqrt(variance) || 0;
    if (!std) continue;
    values.forEach((v, i) => {
      if (Math.abs(v - mean) > 2 * std) {
        anomalies.push({
          date: dates[i],
          category: cat,
          revenue: v,
          delta_pct: mean ? ((v - mean) / mean) * 100 : 0,
        });
      }
    });
  }

  return NextResponse.json({ anomalies });
}
