// web/app/dashboard/page.tsx
'use client';
import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';

interface Kpis {
  revenue: number;
  gm_dollar: number;
  gm_pct: number;
  units: number;
};
type Cat = { /* ... */ };

export default function Dashboard() {
  // New state for filters:
  const [range, setRange] = useState<'7' | '30' | '90' | 'ytd'>('90');  // default Last 90 days
  const [selectedStore, setSelectedStore] = useState<string>('');      // store filter (empty = all)
  const [selectedSku, setSelectedSku] = useState<string>('');          // SKU filter (empty = all)
  
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [cats, setCats] = useState<Cat[]>([]);
  const [marginSteps, setMarginSteps] = useState<Array<{ name: string; value: number }>>([]);
  const [topSkus, setTopSkus] = useState<Array<{ sku: string; revenue: number; gm_dollar: number; gm_pct: number; units: number }>>([]);
  const [anomalies, setAnomalies] = useState<Array<{ date: string; category: string; revenue: number; delta_pct: number }>>([]);
  const [err, setErr] = useState('');

  // Fetch list of stores for dropdown (calls new /api/stores endpoint):
  const [storeList, setStoreList] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/stores');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load stores');
        setStoreList(data.stores || []);
      } catch (e: any) {
        console.error('Error loading store list:', e.message);
      }
    })();
  }, []);
  
  // Helper to compute from/to dates based on selected range
  function getDateRange() {
    const end = dayjs();  // today
    let start;
    if (range === 'ytd') {
      start = dayjs().startOf('year');
    } else {
      const days = Number(range);
      start = end.subtract(days - 1, 'day');
    }
    return {
      from: start.format('YYYY-MM-DD'),
      to: end.format('YYYY-MM-DD')
    };
  }

  useEffect(() => {
    (async () => {
      try {
        const { from, to } = getDateRange();
        // Build query string with from/to and any filters
        const params = new URLSearchParams();
        params.append('from', from);
        params.append('to', to);
        if (selectedStore) params.append('store', selectedStore);
        if (selectedSku) params.append('sku', selectedSku);
        const query = params.toString() ? `?${params.toString()}` : '';

        const [kpiResp, catResp, mwResp, skusResp, anomaliesResp] = await Promise.all([
          fetch(`/api/kpis${query}`, { cache: 'no-store' }),
          fetch(`/api/top-categories${query}`, { cache: 'no-store' }),
          fetch(`/api/margin-waterfall${query}`, { cache: 'no-store' }),
          fetch(`/api/top-skus${query}`, { cache: 'no-store' }),
          fetch(`/api/anomalies${query}`, { cache: 'no-store' })
        ]);
        const kpiData = await kpiResp.json();
        const catData = await catResp.json();
        const mwData = await mwResp.json();
        const skusData = await skusResp.json();
        const anomaliesData = await anomaliesResp.json();
        if (!kpiResp.ok)    throw new Error(kpiData.error    || 'Failed to load KPIs');
        if (!catResp.ok)    throw new Error(catData.error    || 'Failed to load categories');
        if (!mwResp.ok)     throw new Error(mwData.error     || 'Failed to load margin waterfall');
        if (!skusResp.ok)   throw new Error(skusData.error   || 'Failed to load top SKUs');
        if (!anomaliesResp.ok) throw new Error(anomaliesData.error || 'Failed to load anomalies');

        setKpis(kpiData);
        setCats(catData.rows || []);
        setMarginSteps(mwData.steps || []);
        setTopSkus(skusData.rows || []);
        setAnomalies(anomaliesData.anomalies || []);
        setErr('');
      } catch (e: any) {
        setErr(String(e.message || e));
      }
    })();
  }, [range, selectedStore, selectedSku]);  // refetch when timeframe or filters change

  return (
    <main className="grid gap-4">
      {/* Header with title and filters */}
      <div className="flex items-center justify-between">
        <div className="h2">Dashboard</div>
        <div className="flex gap-2">
          {/* Timeframe selector */}
          <select value={range} onChange={e => setRange(e.target.value as any)} className="select">
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="ytd">Year to Date</option>
          </select>
          {/* Store selector */}
          <select value={selectedStore} onChange={e => { setSelectedStore(e.target.value); }} className="select">
            <option value="">All Stores</option>
            {storeList.map(s => (
              <option key={s.id} value={s.id}>{s.name || `Store ${s.id}`}</option>
            ))}
          </select>
        </div>
      </div>

      {err && <div className="card text-red-600">{err}</div>}

      {/* KPI summary tiles */}
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
      
      {/* Revenue trend chart (interactive) */}
      <div className="card">
        <div className="h2 mb-2">Revenue Trend</div>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={kpis?.series || kpis?.trend || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }}
                   tickFormatter={(dateStr) => dayjs(dateStr).format('MMM D')} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(val: number) => `$${Math.round(val).toLocaleString()}`} />
            <Line type="monotone" dataKey="revenue" stroke="#0077b6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
        <div className="text-sm text-muted mt-1">
          *Revenue over time{selectedStore && ` for Store ${selectedStore}`}{selectedSku && ` for SKU ${selectedSku}`}
        </div>
      </div>

      {/* Top categories and Top SKUs side by side */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <div className="h2 mb-3">Top Categories</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="text-left">
                <th className="p-2">Category</th><th className="p-2">Revenue</th><th className="p-2">GM$</th><th className="p-2">GM%</th><th className="p-2">Units</th>
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

        <div className="card">
          <div className="h2 mb-3">Top SKUs</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="text-left">
                <th className="p-2">SKU</th><th className="p-2">Revenue</th><th className="p-2">GM$</th><th className="p-2">GM%</th><th className="p-2">Units</th>
              </tr></thead>
              <tbody>
                {topSkus.map(item => (
                  <tr key={item.sku} className="border-t hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedSku(item.sku)}>
                    <td className="p-2">{item.sku}</td>
                    <td className="p-2">${Math.round(item.revenue).toLocaleString()}</td>
                    <td className="p-2">${Math.round(item.gm_dollar).toLocaleString()}</td>
                    <td className="p-2">{(item.gm_pct * 100).toFixed(1)}%</td>
                    <td className="p-2">{Math.round(item.units).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selectedSku && (
            <div className="text-sm mt-2">
              <button onClick={() => setSelectedSku('')} className="link">← Back to all SKUs</button>
            </div>
          )}
        </div>
      </div>

      {/* Margin waterfall and Anomalies side by side */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <div className="h2 mb-3">Margin Waterfall</div>
          {marginSteps.length === 0 ? (
            <p>No data</p>
          ) : (
            <ul className="space-y-2">
              {marginSteps.map(step => (
                <li key={step.name} className="flex justify-between">
                  <span>{step.name}</span>
                  <span>{step.value >= 0 ? '$' : '-$'}{Math.abs(step.value).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="h2 mb-3">Anomalies</div>
          {anomalies.length === 0 ? (
            <p>No anomalies detected in the selected period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="text-left">
                  <th className="p-2">Date</th><th className="p-2">Category</th><th className="p-2">Revenue</th><th className="p-2">Δ vs avg</th>
                </tr></thead>
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
      </div>
    </main>
  );
}
