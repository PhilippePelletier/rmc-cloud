'use client';
import { useEffect, useState } from 'react';

type Kpis = { revenue: number; gm_dollar: number; gm_pct: number; units: number; series: Array<{ date: string; revenue: number }> };
type Cat = { category: string; rev: number; gm: number; gm_pct: number; units: number };

export default function Dashboard() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [cats, setCats] = useState<Cat[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const a = await fetch('/api/kpis', { cache: 'no-store' });
        const b = await fetch('/api/top-categories', { cache: 'no-store' });
        const aj = await a.json();
        const bj = await b.json();
        if (!a.ok) throw new Error(aj.error || 'Failed to load KPIs');
        if (!b.ok) throw new Error(bj.error || 'Failed to load categories');
        setKpis(aj);
        setCats(bj.rows || []);
      } catch (e: any) {
        setErr(String(e.message || e));
      }
    })();
  }, []);

  return (
    <main className="grid gap-4">
      <div className="h2">Dashboard</div>
      {err && <div className="card text-red-600">{err}</div>}

      {/* KPI tiles */}
      <div className="grid gap-3 md:grid-cols-4">
        <div className="card"><div className="label">Revenue</div><div className="stat">${Math.round(kpis?.revenue ?? 0).toLocaleString()}</div></div>
        <div className="card"><div className="label">GM$</div><div className="stat">${Math.round(kpis?.gm_dollar ?? 0).toLocaleString()}</div></div>
        <div className="card"><div className="label">GM%</div><div className="stat">{((kpis?.gm_pct ?? 0) * 100).toFixed(1)}%</div></div>
        <div className="card"><div className="label">Units</div><div className="stat">{Math.round(kpis?.units ?? 0).toLocaleString()}</div></div>
      </div>

      {/* Revenue trend */}
      <div className="card">
        <div className="h2 mb-2">Revenue (last 60–90 days)</div>
        <div className="text-sm text-muted">Simple SVG trend; replace with your chart lib later.</div>
        <svg viewBox="0 0 600 120" className="w-full mt-3">
          <polyline
            fill="none" stroke="currentColor" strokeWidth="2"
            points={(kpis?.series || []).map((p, i, arr) => {
              const x = (600 * i) / Math.max(arr.length - 1, 1);
              const vals = arr.map(x => x.revenue);
              const min = Math.min(...vals, 0);
              const max = Math.max(...vals, 1);
              const y = 110 - (100 * (p.revenue - min)) / Math.max(max - min, 1);
              return `${x},${y}`;
            }).join(' ')}
          />
        </svg>
      </div>

      {/* Top categories table */}
      <div className="card">
        <div className="h2 mb-3">Top categories</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="text-left">
              <th className="p-2">Category</th>
              <th className="p-2">Revenue</th>
              <th className="p-2">GM$</th>
              <th className="p-2">GM%</th>
              <th className="p-2">Units</th>
            </tr></thead>
            <tbody>
              {cats.map(c => (
                <tr key={c.category} className="border-t">
                  <td className="p-2">{c.category}</td>
                  <td className="p-2">${Math.round(c.rev).toLocaleString()}</td>
                  <td className="p-2">${Math.round(c.gm).toLocaleString()}</td>
                  <td className="p-2">{(c.gm_pct * 100).toFixed(1)}%</td>
                  <td className="p-2">{Math.round(c.units).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
