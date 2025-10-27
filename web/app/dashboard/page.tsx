'use client';

import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

type TrendPoint = {
  date: string;
  revenue: number;
  gm_dollar: number;
  gm_pct: number; // 0–1
  units: number;
};

type Kpis = {
  revenue: number;
  gm_dollar: number;
  gm_pct: number; // 0–1
  units: number;
  series?: TrendPoint[];
  trend?: TrendPoint[]; // backward compat
};

type CategoryRow = {
  category: string;
  rev: number;
  gm: number;
  gm_pct: number; // 0–1
  units: number;
};

type TopSku = {
  sku: string;
  revenue: number;
  gm_dollar: number;
  gm_pct: number; // 0–1
  units: number;
};

type Anomaly = {
  date: string;
  category: string; // can be category or sku label depending on filter scope
  revenue: number;
  delta_pct: number;
};

type Store = { id: string; name: string };

const CATEGORY_COLORS = [
  '#0077b6',
  '#00b4d8',
  '#90e0ef',
  '#48cae4',
  '#0096c7',
  '#023e8a',
  '#ffb703',
  '#fb8500',
  '#52b788',
  '#588157',
];

export default function DashboardPage() {
  // ---- Filters / UI state ----
  const [range, setRange] = useState<'7' | '30' | '90' | 'ytd' | 'custom'>('90');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [selectedStore, setSelectedStore] = useState('');
  const [storeFilter, setStoreFilter] = useState('');

  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSku, setSelectedSku] = useState('');
  const [skuFilter, setSkuFilter] = useState('');

  const [metric, setMetric] = useState<'revenue' | 'gm_dollar' | 'gm_pct' | 'units'>('revenue');

  // Unified filter search query
  const [unifiedQuery, setUnifiedQuery] = useState('');

  // ---- Data state ----
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [topSkus, setTopSkus] = useState<TopSku[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [marginSteps, setMarginSteps] = useState<Array<{ name: string; value: number }>>([]);

  const [storeList, setStoreList] = useState<Store[]>([]);
  const [skuList, setSkuList] = useState<string[]>([]);

  const [err, setErr] = useState('');

  // ---- Helpers ----
  function getDateRange() {
    if (range === 'custom') {
      if (!customFrom || !customTo) return null;
      return { from: customFrom, to: customTo };
    }
    const end = dayjs();
    let start = end;
    if (range === 'ytd') {
      start = dayjs().startOf('year');
    } else {
      const days = Number(range);
      start = end.subtract(days - 1, 'day');
    }
    return {
      from: start.format('YYYY-MM-DD'),
      to: end.format('YYYY-MM-DD'),
    };
  }

  const filteredStoreList = useMemo(() => {
    const q = storeFilter.trim().toLowerCase();
    const dedup = new Map<string, Store>();
    for (const s of storeList) if (!dedup.has(s.id)) dedup.set(s.id, s);
    const arr = Array.from(dedup.values());
    if (!q) return arr;
    return arr.filter(
      (s) =>
        s.id.toLowerCase().includes(q) ||
        (s.name ?? '').toLowerCase().includes(q),
    );
  }, [storeFilter, storeList]);

  const anomalyDateSet = useMemo(() => new Set(anomalies.map((a) => a.date)), [anomalies]);

  const series: TrendPoint[] = useMemo(() => {
    const arr = (kpis?.series ?? kpis?.trend ?? []) as TrendPoint[];
    if (!arr) return [];
    return arr;
  }, [kpis]);

  // ---- Fetch list data ----
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/stores', { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load stores');
        const unique = new Map<string, Store>();
        for (const row of data.stores ?? []) {
          const id = String(row.id ?? row.store_id ?? '');
          if (!id) continue;
          unique.set(id, { id, name: row.name ?? row.store_name ?? `Store ${id}` });
        }
        setStoreList(Array.from(unique.values()));
      } catch (e: any) {
        console.error('Stores load error:', e.message);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/skus', { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load SKUs');
        setSkuList((data.skus ?? []).map((x: any) => String(x)));
      } catch (e: any) {
        console.error('SKUs load error:', e.message);
        // fallback: we’ll still allow clicking top SKUs; search will have fewer items
      }
    })();
  }, []);

  // ---- Fetch dashboard data whenever filters change ----
  useEffect(() => {
    (async () => {
      try {
        const dr = getDateRange();
        if (!dr) return; // wait until custom has both dates
        const params = new URLSearchParams();
        params.append('from', dr.from);
        params.append('to', dr.to);
        if (selectedStore) params.append('store', selectedStore);
        if (selectedCategory) params.append('category', selectedCategory);
        if (selectedSku) params.append('sku', selectedSku);
        const query = `?${params.toString()}`;

        const [kpiResp, catResp, mwResp, skusResp, anomaliesResp] = await Promise.all([
          fetch(`/api/kpis${query}`, { cache: 'no-store' }),
          fetch(`/api/top-categories${query}`, { cache: 'no-store' }),
          fetch(`/api/margin-waterfall${query}`, { cache: 'no-store' }),
          fetch(`/api/top-skus${query}`, { cache: 'no-store' }),
          fetch(`/api/anomalies${query}`, { cache: 'no-store' }),
        ]);

        const kpiData = await kpiResp.json();
        const catData = await catResp.json();
        const mwData = await mwResp.json();
        const skusData = await skusResp.json();
        const anomaliesData = await anomaliesResp.json();

        if (!kpiResp.ok) throw new Error(kpiData.error || 'Failed to load KPIs');
        if (!catResp.ok) throw new Error(catData.error || 'Failed to load categories');
        if (!mwResp.ok) throw new Error(mwData.error || 'Failed to load margin waterfall');
        if (!skusResp.ok) throw new Error(skusData.error || 'Failed to load top SKUs');
        if (!anomaliesResp.ok) throw new Error(anomaliesData.error || 'Failed to load anomalies');

        setKpis(kpiData);
        setCategories(catData.rows ?? []);
        setMarginSteps(mwData.steps ?? []);
        setTopSkus(skusData.rows ?? []);
        setAnomalies(anomaliesData.anomalies ?? []);
        setErr('');
      } catch (e: any) {
        setErr(String(e?.message ?? e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, customFrom, customTo, selectedStore, selectedCategory, selectedSku]);

  // ---- Derived lists ----
  const categoryList = useMemo(() => {
    const set = new Set<string>();
    for (const c of categories) if (c?.category) set.add(c.category);
    return Array.from(set).sort();
  }, [categories]);

  // ---- Handlers ----
  function handleReset() {
    setRange('90');
    setCustomFrom('');
    setCustomTo('');
    setSelectedStore('');
    setStoreFilter('');
    setSelectedCategory('');
    setSelectedSku('');
    setSkuFilter('');
    setUnifiedQuery('');
    setMetric('revenue');
  }

  function handleResetData() {
    handleReset();
    setKpis(null);
    setCategories([]);
    setMarginSteps([]);
    setTopSkus([]);
    setAnomalies([]);
  }

  function handleUnifiedSelect() {
    const val = unifiedQuery.trim();
    if (!val) return;
    if (val.startsWith('Store: ')) {
      const name = val.slice(7);
      const store = storeList.find((s) => s.name === name || s.id === name);
      if (store) {
        setSelectedStore(store.id);
      }
    } else if (val.startsWith('SKU: ')) {
      const sku = val.slice(5);
      if (skuList.includes(sku)) {
        setSelectedSku(sku);
      }
    } else if (val.startsWith('Category: ')) {
      const cat = val.slice(10);
      if (categoryList.includes(cat)) {
        setSelectedCategory(cat);
      }
    }
    setUnifiedQuery('');
  }

  // ---- Sidebar anomaly explainer (opens from table click) ----
  const [explainerOpen, setExplainerOpen] = useState(false);
  const [currentAnomaly, setCurrentAnomaly] = useState<Anomaly | null>(null);
  const [explanation, setExplanation] = useState('');

  async function handleAnomalyClick(a: Anomaly) {
    setCurrentAnomaly(a);
    setExplainerOpen(true);
    setExplanation('');
    try {
      const params = new URLSearchParams();
      params.append('date', a.date);
      params.append('category', a.category);
      params.append('revenue', Math.round(a.revenue ?? 0).toString());
      params.append('delta', a.delta_pct.toFixed(1));
      if (selectedStore) params.append('store', selectedStore);
      if (selectedSku) params.append('sku', selectedSku);
      const res = await fetch(`/api/anomaly-explain?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Explanation failed');
      setExplanation(data.explanation || 'No explanation generated.');
    } catch (e: any) {
      setExplanation('Sorry, could not generate explanation.');
      console.error(e);
    }
  }

  // ---- Render ----
  return (
    <main className="p-6">
      {/* Centered Dashboard title */}
      <h1 className="text-3xl font-bold text-center mb-6">Dashboard</h1>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        {/* Unified Filters */}
        <div className="card p-4 flex-1">
          <label className="label block mb-1">Filters</label>
          <input
            type="text"
            list="unified-suggestions"
            value={unifiedQuery}
            onChange={(e) => setUnifiedQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleUnifiedSelect(); }}
            onBlur={handleUnifiedSelect}
            placeholder="Store, SKU, or Category"
            className="input w-full"
          />
          <datalist id="unified-suggestions">
            {storeList.map((s) => (
              <option key={`store-${s.id}`} value={`Store: ${s.name}`} />
            ))}
            {categoryList.map((c) => (
              <option key={`cat-${c}`} value={`Category: ${c}`} />
            ))}
            {skuList.slice(0, 100).map((sku) => (
              <option key={`sku-${sku}`} value={`SKU: ${sku}`} />
            ))}
          </datalist>
        </div>

        {/* Timeframe */}
        <div className="card p-4 flex-1">
          <label className="label block mb-1">Timeframe</label>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as any)}
            className="select w-full"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="ytd">Year to Date</option>
            <option value="custom">Custom…</option>
          </select>
          {range === 'custom' && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="input flex-1"
                />
                <span>to</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="input flex-1"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn flex-1"
                  onClick={() => {
                    /* Apply already triggers effect */
                  }}
                >
                  Apply
                </button>
                <button
                  type="button"
                  className="btn btn-outline flex-1"
                  onClick={() => {
                    setCustomFrom('');
                    setCustomTo('');
                    setRange('90');
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="card p-4 flex-1">
          <label className="label block mb-1">Settings</label>
          <details className="dropdown">
            <summary className="btn w-full">☰ Menu</summary>
            <ul className="dropdown-content menu p-2 shadow bg-white rounded-box w-52">
              <li>
                <button type="button" onClick={handleReset} className="flex items-center gap-2">
                  🔄 Reset Filters
                </button>
              </li>
              <li>
                <button type="button" onClick={handleResetData} className="flex items-center gap-2 text-red-600">
                  🗑️ Reset Data
                </button>
              </li>
            </ul>
          </details>
        </div>
      </div>

      {/* Error */}
      {err && <div className="card text-red-600 p-3">{err}</div>}

      {/* Subtle divider line */}
      <hr className="border-t border-gray-300 my-6" />

      {/* KPI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="card">
          <div className="label">Revenue</div>
          <div className="stat">
            ${Math.round(kpis?.revenue ?? 0).toLocaleString()}
          </div>
        </div>
        <div className="card">
          <div className="label">GM$</div>
          <div className="stat">
            ${Math.round(kpis?.gm_dollar ?? 0).toLocaleString()}
          </div>
        </div>
        <div className="card">
          <div className="label">GM%</div>
          <div className="stat">
            {((kpis?.gm_pct ?? 0) * 100).toFixed(1)}%
          </div>
        </div>
        <div className="card">
          <div className="label">Units</div>
          <div className="stat">{Math.round(kpis?.units ?? 0).toLocaleString()}</div>
        </div>
      </div>

      {/* Metric toggle + Trend */}
      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="h2">
            {metric === 'revenue' && 'Revenue Trend'}
            {metric === 'gm_dollar' && 'Gross Margin $ Trend'}
            {metric === 'gm_pct' && 'Gross Margin % Trend'}
            {metric === 'units' && 'Units Trend'}
          </div>
          <div className="flex gap-2">
            <button
              className={`btn btn-sm ${metric === 'revenue' ? 'btn-active' : ''}`}
              onClick={() => setMetric('revenue')}
            >
              Revenue
            </button>
            <button
              className={`btn btn-sm ${metric === 'gm_dollar' ? 'btn-active' : ''}`}
              onClick={() => setMetric('gm_dollar')}
            >
              GM$
            </button>
            <button
              className={`btn btn-sm ${metric === 'gm_pct' ? 'btn-active' : ''}`}
              onClick={() => setMetric('gm_pct')}
            >
              GM%
            </button>
            <button
              className={`btn btn-sm ${metric === 'units' ? 'btn-active' : ''}`}
              onClick={() => setMetric('units')}
            >
              Units
            </button>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={series}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              tickFormatter={(d: string) => dayjs(d).format('MMM D')}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(val) => {
                if (metric === 'gm_pct') return (Number(val) * 100).toFixed(0) + '%';
                if (metric === 'revenue' || metric === 'gm_dollar')
                  return '$' + Math.round(Number(val)).toLocaleString();
                return Math.round(Number(val)).toLocaleString();
              }}
            />
            <Tooltip
              formatter={(val) => {
                if (metric === 'gm_pct') return (Number(val) * 100).toFixed(1) + '%';
                if (metric === 'revenue' || metric === 'gm_dollar')
                  return '$' + Math.round(Number(val)).toLocaleString();
                return Math.round(Number(val)).toLocaleString();
              }}
              labelFormatter={(d) => d}
            />
            <Line
              type="monotone"
              dataKey={metric}
              stroke={
                metric === 'revenue'
                  ? '#0077b6'
                  : metric === 'gm_dollar'
                  ? '#52b788'
                  : metric === 'gm_pct'
                  ? '#ffb703'
                  : '#fb8500'
              }
              strokeWidth={2}
              dot={{
                // subtle dot styling
                r: 0,
              }}
              activeDot={(props: any) =>
                anomalyDateSet.has(props.payload.date) ? (
                  <circle cx={props.cx} cy={props.cy} r={6} fill="#e63946" stroke="#e63946" />
                ) : (
                  <circle cx={props.cx} cy={props.cy} r={4} />
                )
              }
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="text-sm text-muted mt-1">
          * {metric === 'revenue'
            ? 'Revenue'
            : metric === 'gm_dollar'
            ? 'Gross Margin $'
            : metric === 'gm_pct'
            ? 'Gross Margin %'
            : 'Units'}{' '}
          over time
          {selectedStore && ` · Store ${selectedStore}`}
          {selectedCategory && ` · Category ${selectedCategory}`}
          {selectedSku && ` · SKU ${selectedSku}`}
        </div>
      </div>

      {/* Top Categories (Pie + Table) and Top SKUs */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-4">
          <div className="h2 mb-2">Top Categories</div>
          {/* Pie */}
          {categories.length > 0 && (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={categories.map((c) => ({ name: c.category, value: c.rev }))}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  labelLine={false}
                  label={({ percent }) => `${Math.round(percent * 100)}%`}
                >
                  {categories.map((_, i) => (
                    <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val) => '$' + Math.round(Number(val)).toLocaleString()}
                />
              </PieChart>
            </ResponsiveContainer>
          )}

          {/* Table */}
          <div className="overflow-x-auto mt-3">
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
                {categories.map((c) => (
                  <tr
                    key={c.category}
                    className="border-t hover:bg-gray-50 cursor-pointer"
                    onClick={() =>
                      setSelectedCategory((prev) =>
                        prev === c.category ? '' : c.category
                      )
                    }
                  >
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
          {selectedCategory && (
            <div className="text-sm mt-2">
              <button
                onClick={() => setSelectedCategory('')}
                className="link"
              >
                ← Clear category
              </button>
            </div>
          )}
        </div>

        <div className="card p-4">
          <div className="h2 mb-2">Top SKUs</div>
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
                {topSkus.map((item) => (
                  <tr
                    key={item.sku}
                    className="border-t hover:bg-gray-50 cursor-pointer"
                    onClick={() =>
                      setSelectedSku((prev) => (prev === item.sku ? '' : item.sku))
                    }
                  >
                    <td className="p-2">{item.sku}</td>
                    <td className="p-2">
                      ${Math.round(item.revenue).toLocaleString()}
                    </td>
                    <td className="p-2">
                      ${Math.round(item.gm_dollar).toLocaleString()}
                    </td>
                    <td className="p-2">{(item.gm_pct * 100).toFixed(1)}%</td>
                    <td className="p-2">{Math.round(item.units).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selectedSku && (
            <div className="text-sm mt-2">
              <button onClick={() => setSelectedSku('')} className="link">
                ← Clear SKU
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Margin Waterfall + Anomalies */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-4">
          <div className="h2 mb-3">Margin Waterfall</div>
          {marginSteps.length === 0 ? (
            <p className="text-sm text-muted">No data</p>
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

        <div className="card p-4">
          <div className="h2 mb-3">Anomalies</div>
          {anomalies.length === 0 ? (
            <p className="text-sm text-muted">No anomalies detected in the selected period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="p-2">Date</th>
                    <th className="p-2">Category/SKU</th>
                    <th className="p-2">Revenue</th>
                    <th className="p-2">Δ vs avg</th>
                  </tr>
                </thead>
                <tbody>
                  {anomalies.map((a, idx) => (
                    <tr
                      key={idx}
                      className="border-t hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleAnomalyClick(a)}
                    >
                      <td className="p-2">{a.date}</td>
                      <td className="p-2">{a.category}</td>
                      <td className="p-2">
                        ${Math.round(a.revenue).toLocaleString()}
                      </td>
                      <td className="p-2">{a.delta_pct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* AI explanation sidebar */}
      {explainerOpen && (
        <div className="fixed top-0 right-0 z-50 h-full w-96 overflow-y-auto border-l bg-white p-4 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-lg font-semibold">Anomaly Details</div>
            <button className="text-xl" onClick={() => setExplainerOpen(false)}>
              ✕
            </button>
          </div>
          <div className="mb-3 text-sm text-gray-700">
            <div>
              <strong>Date:</strong> {currentAnomaly?.date}
            </div>
            <div>
              <strong>Category/SKU:</strong> {currentAnomaly?.category}
            </div>
            <div>
              <strong>Revenue:</strong> $
              {Math.round(currentAnomaly?.revenue ?? 0).toLocaleString()}
            </div>
            <div>
              <strong>Δ vs avg:</strong> {currentAnomaly?.delta_pct.toFixed(1)}%
            </div>
          </div>
          <div>
            {explanation ? (
              <p className="text-sm whitespace-pre-wrap">{explanation}</p>
            ) : (
              <p>Analyzing anomaly…</p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
