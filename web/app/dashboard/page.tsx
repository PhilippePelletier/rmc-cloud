'use client';
import { useEffect, useState } from 'react';

type Kpis = {
  revenue: number;
  gm_dollar: number;
  gm_pct: number;
  units: number;
  series: Array<{ date: string; revenue: number }>;
};

type Cat = {
  category: string;
  rev: number;
  gm: number;
  gm_pct: number;
  units: number;
};

export default function Dashboard() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [cats, setCats] = useState<Cat[]>([]);
  const [err, setErr] = useState('');
  const [marginSteps, setMarginSteps] = useState<
    Array<{ name: string; value: number }>
  >([]);
  const [topSkus, setTopSkus] = useState<
    Array<{ sku: string; revenue: number; gm_dollar: number; gm_pct: number; units: number }>
  >([]);
  const [anomalies, setAnomalies] = useState<
    Array<{ date: string; category: string; revenue: number; delta_pct: number }>
  >([]);


  useEffect(() => {
    (async () => {
      try {
        // Fetch existing data
        const kpiResp  = await fetch('/api/kpis',           { cache: 'no-store' });
        const catResp  = await fetch('/api/top-categories', { cache: 'no-store' });
        // Fetch new data
        const mwResp   = await fetch('/api/margin-waterfall', { cache: 'no-store' });
        const skusResp = await fetch('/api/top-skus',       { cache: 'no-store' });

        const kpiData  = await kpiResp.json();
        const catData  = await catResp.json();
        const mwData   = await mwResp.json();
        const skusData = await skusResp.json();

        if (!kpiResp.ok)  throw new Error(kpiData.error  || 'Failed to load KPIs');
        if (!catResp.ok)  throw new Error(catData.error  || 'Failed to load categories');
        if (!mwResp.ok)   throw new Error(mwData.error   || 'Failed to load margin waterfall');
        if (!skusResp.ok) throw new Error(skusData.error || 'Failed to load top SKUs');

        setKpis(kpiData);
        setCats(catData.rows || []);
        setMarginSteps(mwData.steps || []);
        setTopSkus(skusData.rows || []);
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
        <div className="card">
          <div className="label">Revenue</div>
          <div className="stat">${Math.round(kpis?.revenue ?? 0).toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="label">GM$</div>
          <div className="stat">${Math.round(kpis?.gm_dollar ?? 0).toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="label">GM%</div>
          <div className="stat">{((kpis?.gm_pct ?? 0) * 100).toFixed(1)}%</div>
        </div>
        <div className="card">
          <div className="label">Units</div>
          <div className="stat">{Math.round(kpis?.units ?? 0).toLocaleString()}</div>
        </div>
      </div>

      {/* Revenue trend */}
      <div className="card">
        <div className="h2 mb-2">Revenue (last 60–90 days)</div>
        <div className="text-sm text-muted">Simple SVG trend; replace with your chart lib later.</div>
        <svg viewBox="0 0 600 120" className="w-full mt-3">
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
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

      {/* Top categories card */}
      <div className="card">
        <div className="h2 mb-3">Top categories</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="p-2">Category</th>
                <th className="p-2">Revenue</th>
                <th className="p-2">GM$</th>
                <th className="p-2">GM%</th>
                <th className="p-2">Units</th>
              </tr>
            </thead>
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

      {/* Margin waterfall card */}
      <div className="card">
        <div className="h2 mb-3">Margin waterfall</div>
        {marginSteps.length === 0 ? (
          <p>No data</p>
        ) : (
          <ul className="space-y-2">
            {marginSteps.map((step) => (
              <li key={step.name} className="flex justify-between">
                <span>{step.name}</span>
                <span>
                  {step.value >= 0 ? '$' : '-$'}
                  {Math.abs(step.value).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Top SKUs card */}
      <div className="card">
        <div className="h2 mb-3">Top SKUs</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="p-2">SKU</th>
                <th className="p-2">Revenue</th>
                <th className="p-2">GM$</th>
                <th className="p-2">GM%</th>
                <th className="p-2">Units</th>
              </tr>
            </thead>
            <tbody>
              {topSkus.map((sku) => (
                <tr key={sku.sku} className="border-t">
                  <td className="p-2">{sku.sku}</td>
                  <td className="p-2">${Math.round(sku.revenue).toLocaleString()}</td>
                  <td className="p-2">${Math.round(sku.gm_dollar).toLocaleString()}</td>
                  <td className="p-2">{(sku.gm_pct * 100).toFixed(1)}%</td>
                  <td className="p-2">{Math.round(sku.units).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
        {/* Anomalies card */}
      <div className="card">
        <div className="h2 mb-3">Anomalies</div>
        {anomalies.length === 0 ? (
          <p>No anomalies detected in the selected period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="p-2">Date</th>
                  <th className="p-2">Category</th>
                  <th className="p-2">Revenue</th>
                  <th className="p-2">Δ vs mean (%)</th>
                </tr>
              </thead>
              <tbody>
                {anomalies.map((a, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="p-2">{a.date}</td>
                    <td className="p-2">{a.category}</td>
                    <td className="p-2">${Math.round(a.revenue).toLocaleString()}</td>
                    <td className="p-2">{a.delta_pct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </main>
  );
}
