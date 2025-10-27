// web/app/dashboard/page.tsx
'use client';
import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

interface Kpis {
  revenue: number;
  gm_dollar: number;
  gm_pct: number;
  units: number;
  trend: { date: string; revenue: number }[];   // trend timeseries
  series: { date: string; revenue: number }[];  // alias for trend
  disc_pct?: number;  // optional: discount% if ever used
};
type Cat = {
  category: string;
  rev: number;
  gm: number;
  gm_pct: number;
  units: number;
};
type Anomaly = {
  date: string;
  category: string;
  revenue: number;
  delta_pct: number;
};


export default function Dashboard() {
  // States for filters:
  const [range, setRange] = useState<'7' | '30' | '90' | 'ytd'>('90');        // timeframe filter (default 90 days)
  const [selectedStore, setSelectedStore] = useState<string>('');            // store filter (empty = all)
  const [selectedCategory, setSelectedCategory] = useState<string>('');      // NEW: category filter (empty = all)
  const [selectedSku, setSelectedSku] = useState<string>('');                // SKU filter (empty = all)
  const [storeFilter, setStoreFilter] = useState<string>('');                // NEW: search term for store filter 

  const [showCustom, setShowCustom] = useState(false);       // whether the custom date picker is visible
  const [customFrom, setCustomFrom] = useState('');          // custom range start date (YYYY-MM-DD)
  const [customTo, setCustomTo] = useState('');              // custom range end date (YYYY-MM-DD)

  const [metric, setMetric] = useState<'revenue' | 'gm_dollar' | 'gm_pct' | 'units'>('revenue');

  const [explainerOpen, setExplainerOpen] = useState(false); // whether the AI explanation sidebar is open
  const [currentAnomaly, setCurrentAnomaly] = useState<Anomaly | null>(null);
  const [explanation, setExplanation] = useState('');        // text of the AI explanation

  
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [cats, setCats] = useState<Cat[]>([]);
  const [marginSteps, setMarginSteps] = useState<Array<{ name: string; value: number }>>([]);
  const [topSkus, setTopSkus] = useState<Array<{ sku: string; revenue: number; gm_dollar: number; gm_pct: number; units: number }>>([]);
  const [anomalies, setAnomalies] = useState<Array<{ date: string; category: string; revenue: number; delta_pct: number }>>([]);
  const [err, setErr] = useState('');

  // Fetch list of stores for dropdown:
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

  const [skuList, setSkuList] = useState<string[]>([]); 
  useEffect(() => {
  (async () => {
    try {
      const res = await fetch('/api/skus')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load SKUs')
      setSkuList(data.skus || [])
    } catch (e: any) {
      console.error('Error loading SKU list:', e.message)
    }
  })()
}, [])


  // NEW: Fetch list of categories for dropdown:
  const [categoryList, setCategoryList] = useState<string[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/categories');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load categories');
        setCategoryList(data.categories || []);
      } catch (e: any) {
        console.error('Error loading category list:', e.message);
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

  // Fetch all dashboard data whenever filters or range change
  useEffect(() => {
    // Determine the date range to query
    let from: string | undefined, to: string | undefined
    if (range === 'custom') {
      from = customFrom
      to = customTo
    } else {
      ({ from, to } = getDateRange(range))  // assume getDateRange(range) returns {from, to} for presets
    }
    if (!from || !to) {
      return  // if custom range not fully specified, do not fetch yet
    }
        // Build query string with from/to and any filters
        const params = new URLSearchParams();
        params.append('from', from);
        params.append('to', to);
        if (selectedStore)    params.append('store', selectedStore);
        if (selectedCategory) params.append('category', selectedCategory);   // NEW: include category filter
        if (selectedSku)      params.append('sku', selectedSku);
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
        if (!kpiResp.ok)       throw new Error(kpiData.error      || 'Failed to load KPIs');
        if (!catResp.ok)       throw new Error(catData.error      || 'Failed to load categories');
        if (!mwResp.ok)        throw new Error(mwData.error       || 'Failed to load margin waterfall');
        if (!skusResp.ok)      throw new Error(skusData.error     || 'Failed to load top SKUs');
        if (!anomaliesResp.ok) throw new Error(anomaliesData.error|| 'Failed to load anomalies');

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
  }, [range, selectedStore, selectedCategory, selectedSku]);  // UPDATED: refetch when timeframe or any filter changes

  // Compute filtered store list based on search input
  const filteredStoreList = storeList.filter(s => {
    const term = storeFilter.toLowerCase();
    const name = (s.name || `Store ${s.id}`).toLowerCase();
    return name.includes(term) || String(s.id).toLowerCase().includes(term);
  });

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
          {/* Store search and selector */}
          <input 
            type="text" 
            value={storeFilter} 
            onChange={e => setStoreFilter(e.target.value)} 
            placeholder="Search store..." 
            className="input w-40" 
          />
          <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)} className="select">
            <option value="">All Stores</option>
            {filteredStoreList.map(s => (
              <option key={s.id} value={s.id}>{s.name || `Store ${s.id}`}</option>
            ))}
          </select>
          {/* Category selector */}
          <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="select">
            <option value="">All Categories</option>
            {categoryList.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          {/* SKU filter (new) */}
          <input 
            type="text" 
            value={skuFilter} 
            onChange={e => setSkuFilter(e.target.value)} 
            placeholder="Search SKU..." 
            className="input w-40"
          />
          <select 
            value={selectedSku} 
            onChange={e => setSelectedSku(e.target.value)} 
            className="select"
          >
            <option value="">All SKUs</option>
            {skuList
              .filter(sku => sku.toLowerCase().includes(skuFilter.toLowerCase()))
              .map(sku => (
                <option key={sku} value={sku}>{sku}</option>
              ))}
          </select>
          {selectedSku && (
            <button 
              type="button" 
              onClick={() => { setSelectedSku(''); setSkuFilter(''); }} 
              className="btn btn-sm"
              title="Clear SKU filter"
            >
              ✕
            </button>
          )}
        
          {/* Date range selector (existing) */}
          <select value={range} onChange={e => setRange(e.target.value as any)} className="select">
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="ytd">Year to Date</option>
          </select>
        
          {/* Custom range toggle (new) */}
          <button type="button" onClick={() => setShowCustom(true)} className="btn">
            Custom Range
          </button>
        
          {/* Reset all filters (new) */}
          <button type="button" onClick={handleReset} className="btn btn-outline ml-auto">
            Reset Filters
          </button>
        </div>
      </div>

      {showCustom && (
        <div className="flex items-center gap-2 mb-4">
          <input 
            type="date" 
            value={customFrom} 
            onChange={e => setCustomFrom(e.target.value)} 
            className="input"
          />
          <span>to</span>
          <input 
            type="date" 
            value={customTo} 
            onChange={e => setCustomTo(e.target.value)} 
            className="input"
          />
          <button 
            type="button" 
            className="btn" 
            onClick={() => {
              if (customFrom && customTo) {
                setRange('custom')
                setShowCustom(false)
              }
            }}
          >
            Apply
          </button>
          <button 
            type="button" 
            className="btn" 
            onClick={() => {
              setShowCustom(false)
              // (Optional) clear customFrom/To if canceling:
              // setCustomFrom(''); setCustomTo('');
            }}
          >
            Cancel
          </button>
        </div>
      )}

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
      
      {/* Revenue trend chart */}
      <div className="card mb-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-semibold">
            {metric === 'revenue' && 'Revenue Trend'}
            {metric === 'gm_dollar' && 'Gross Margin $ Trend'}
            {metric === 'gm_pct' && 'Gross Margin % Trend'}
            {metric === 'units' && 'Units Sold Trend'}
          </h2>
          <div>
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
        
        {/* Line chart for the selected metric */}
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={kpis?.series || []}>
            <CartesianGrid stroke="#f5f5f5" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }} 
              tickFormatter={(dateStr) => formatDateTick(dateStr)}  // assume you have a date formatter
            />
            <YAxis 
              tick={{ fontSize: 12 }} 
              tickFormatter={(val) => {
                if (metric === 'gm_pct') return (val * 100).toFixed(0) + '%'
                if (metric === 'revenue' || metric === 'gm_dollar') return '$' + Math.round(val).toLocaleString()
                return Math.round(val).toLocaleString()
              }}
            />
            <Tooltip 
              formatter={(val: number) => {
                if (metric === 'gm_pct') return (val * 100).toFixed(1) + '%'
                if (metric === 'revenue' || metric === 'gm_dollar') return '$' + Math.round(val).toLocaleString()
                return Math.round(val).toLocaleString()
              }}
              labelFormatter={(dateStr) => `Date: ${dateStr}`}
            />
            <Line 
              type="monotone" 
              dataKey={metric} 
              stroke={
                metric === 'revenue' ? "#0077b6" 
                : metric === 'gm_dollar' ? "#52b788" 
                : metric === 'gm_pct' ? "#ffb703" 
                : "#fb8500"
              }
              strokeWidth={2}
              dot={(props) => {
                // Highlight anomaly dates with a red dot
                const dt = props.payload.date
                const anomalyDates = new Set(anomalies.map(a => a.date))
                if (anomalyDates.has(dt)) {
                  return <circle cx={props.cx} cy={props.cy} r={5} fill="red" stroke="red" />
                }
                return null
              }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      
        {/* (Optional) descriptive text */}
        <p className="text-sm text-gray-600 mt-2">
          {metric === 'revenue' && 'Revenue'}
          {metric === 'gm_dollar' && 'Gross Margin $'}
          {metric === 'gm_pct' && 'Gross Margin %'}
          {metric === 'units' && 'Units'}
          {` over time for ${selectedStore ? 'Store ' + storeNameMap[selectedStore] : 'All Stores'}, `}
          {selectedCategory ? `Category "${selectedCategory}"` : 'All Categories'}
          {selectedSku ? `, SKU ${selectedSku}` : ''}
          {` from ${formatDate(from)} to ${formatDate(to)}.`}
        </p>
      </div>

      {/* Top Categories and Top SKUs side by side */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <div className="h2 mb-3">Top Categories</div>
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
                  <tr 
                    key={c.category} 
                    className="border-t hover:bg-gray-50 cursor-pointer" 
                    onClick={() => setSelectedCategory(c.category)}
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
              <button onClick={() => setSelectedCategory('')} className="link">← Back to all Categories</button>
            </div>
          )}
        </div>

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
                {topSkus.map(item => (
                  <tr 
                    key={item.sku} 
                    className="border-t hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedSku(item.sku)}
                  >
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

      {/* Margin Waterfall and Anomalies side by side */}
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
                <thead>
                  <tr className="text-left">
                    <th className="p-2">Date</th>
                    <th className="p-2">Category</th>
                    <th className="p-2">Revenue</th>
                    <th className="p-2">Δ vs avg</th>
                  </tr>
                </thead>
                <tbody>
                  {anomalies.map((a, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2">{a.date}</td>
                      <td className="p-2">
                        <button onClick={() => setSelectedCategory(a.category)} className="link">
                          {a.category}
                        </button>
                      </td>
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
