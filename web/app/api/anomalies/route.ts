import { NextResponse, type NextRequest } from "next/server";
import { getApiContext } from "@/app/lib/api-ctx";

export const dynamic = "force-dynamic";

type Anomaly = { date: string; category: string; revenue: number; delta_pct: number };

export async function GET(req: NextRequest) {
  const ctx = await getApiContext();
  if ("error" in ctx) return ctx.error;
  const { supabase, groupId } = ctx;

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to   = url.searchParams.get("to");
  const store = url.searchParams.get("store");
  const sku   = url.searchParams.get("sku");

  // Determine date range: use provided range or default to last 90 days
  let startDate: string | undefined = from || undefined;
  let endDate: string | undefined = to || undefined;
  if (!startDate || !endDate) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 89);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    if (!startDate) startDate = fmt(start);
    if (!endDate) endDate = fmt(end);
  }

  // If a specific SKU is selected, perform anomaly detection on that SKU's daily sales
  if (sku) {
    let qs = supabase.from("sales")
      .select("date, net_sales")
      .eq("group_id", groupId)
      .eq("sku", sku);
    if (store) qs = qs.eq("store_id", store);
    if (startDate) qs = qs.gte("date", startDate);
    if (endDate)   qs = qs.lte("date", endDate);

    const { data: salesData, error: salesErr } = await qs;
    if (salesErr) {
      return NextResponse.json({ error: salesErr.message }, { status: 500 });
    }
    const salesRows = salesData ?? [];

    // Aggregate sales by date for the SKU
    const dates: string[] = [];
    const values: number[] = [];
    for (const row of salesRows) {
      dates.push(row.date);
      values.push(Number(row.net_sales ?? 0));
    }
    // Ensure data is sorted by date
    const combined = dates.map((d, i) => ({ date: d, value: values[i] }));
    combined.sort((a, b) => a.date.localeCompare(b.date));
    const sortedValues = combined.map(item => item.value);
    const sortedDates = combined.map(item => item.date);

    const anomalies: Array<{ date: string; category: string; revenue: number; delta_pct: number }> = [];
    if (sortedValues.length >= 4) {  // need a few points to detect anomalies
      const mean = sortedValues.reduce((sum, v) => sum + v, 0) / sortedValues.length;
      const variance = sortedValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / sortedValues.length;
      const std = Math.sqrt(variance) || 0;
      if (std > 0) {
        sortedValues.forEach((val, i) => {
          if (Math.abs(val - mean) > 2 * std) {
            anomalies.push({
              date: sortedDates[i],
              category: sku,  // label the anomaly with the SKU code (or could use product name if available)
              revenue: val,
              delta_pct: mean ? ((val - mean) / mean) * 100 : 0
            });
          }
        });
      }
    }
    return NextResponse.json({ anomalies });
  }

  // Otherwise, perform anomaly detection by category using daily_agg data
  let q = supabase.from("daily_agg")
    .select("date, category, net_sales")
    .eq("group_id", groupId);
  if (store)    q = q.eq("store_id", store);
  if (startDate) q = q.gte("date", startDate);
  if (endDate)   q = q.lte("date", endDate);

  const { data, error } = await q.order("date", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const rows = data ?? [];

  const anomalies: Array<{ date: string; category: string; revenue: number; delta_pct: number }> = [];
  // Group data by category
  const grouped: Record<string, { dates: string[]; values: number[] }> = {};
  for (const row of rows) {
    const cat = row.category ?? "Uncategorized";
    const value = Number(row.net_sales ?? 0);
    (grouped[cat] ??= { dates: [], values: [] }).dates.push(row.date);
    grouped[cat].values.push(value);
  }
  // For each category, detect anomalies in its time series
  for (const [cat, { dates, values }] of Object.entries(grouped)) {
    if (values.length < 4) continue; // need at least a few data points
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
          delta_pct: mean ? ((v - mean) / mean) * 100 : 0
        });
      }
    });
  }

  return NextResponse.json({ anomalies });
}
