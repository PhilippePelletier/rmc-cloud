// app/api/anomalies/route.ts
import { NextResponse } from "next/server";
import { getApiContext } from "@/app/lib/api-ctx";

export const dynamic = "force-dynamic";

type Row = {
  date: string;
  category: string | null;
  net_sales: number | null;
};

export async function GET() {
  // Centralized auth + Supabase client + tenant (org or user)
  const ctx = await getApiContext();
  if ("error" in ctx) return ctx.error;
  const { supa, groupId } = ctx;

  // Pull the series for this tenant
  const { data, error } = await supa
    .from("daily_agg")
    .select("date, category, net_sales")
    .eq("group_id", groupId)            // <-- tenant scoping
    .order("date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by category
  const grouped: Record<string, { dates: string[]; values: number[] }> = {};
  for (const row of (data as Row[]) ?? []) {
    const cat = row.category ?? "Uncategorized";
    const v = Number(row.net_sales ?? 0);
    (grouped[cat] ??= { dates: [], values: [] }).dates.push(row.date);
    grouped[cat].values.push(v);
  }

  // Simple 2-sigma anomaly detection per category
  const anomalies: Array<{ date: string; category: string; revenue: number; delta_pct: number }> = [];
  for (const [cat, { dates, values }] of Object.entries(grouped)) {
    if (values.length < 4) continue; // need a little history
    const mean = values.reduce((a, v) => a + v, 0) / values.length;
    const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
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
