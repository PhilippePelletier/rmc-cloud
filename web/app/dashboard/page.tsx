// web/app/dashboard/page.tsx
'use client';
import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

interface Kpis {
  revenue: number;
  gm_dollar: number;
  gm_pct: number;
  units: number;
  trend: { date: string; revenue: number }[];
  series: { date: string; revenue: number; gm_dollar?: number; gm_pct?: number; units?: number }[];
  disc_pct?: number;
}
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
  // Filter states:
  const [range, setRange] = useState<'7'|'30'|'90'|'ytd'|'custom'>('90');
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSku, setSelectedSku] = useState<string>('');
  const [storeFilter, setStoreFilter] = useState<string>('');
  const [skuFilter, setSkuFilter] = useState<string>('');
  
  const [showCustom, setShowCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Metric to display on the trend chart:
  const [metric, setMetric] = useState<'revenue'|'gm_dollar'|'gm_pct'|'units'>('revenue');

  // Anomaly explanation state:
  const [explainerOpen, setExplainerOpen] = useState(false);
  const [currentAnomaly, setCurrentAnomaly] = useState<Anomaly|null>(null);
  const [explanation, setExplanation] = useState('');

  // Data states:
  const [kpis, setKpis] = useState<Kpis|null>(null);
  const [cats, setCats] = useState<Cat[]>([]);
  const [marginSteps, setMarginSteps] = useState<{name:string; value:number}[]>([]);
  const [topSkus, setTopSkus] = useState<{sku:string; revenue:number; gm_dollar:number; gm_pct:number; units:number;}[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [err, setErr] = useState('');

  // Dropdown lists:
  const [storeList, setStoreList] = useState<{id:string; name:string;}[]>([]);
  const [skuList, setSkuList] = useState<string[]>([]);
  const [categoryList, setCategoryList] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/stores');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load stores');
        setStoreList(data.stores || []);
      } catch(e:any) { console.error(e); }
    })();
    (async () => {
      try {
        const res = await fetch('/api/skus');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load SKUs');
        setSkuList(data.skus || []);
      } catch(e:any) { console.error(e); }
    })();
    (async () => {
      try {
        const res = await fetch('/api/categories');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load categories');
        setCategoryList(data.categories || []);
      } catch(e:any) { console.error(e); }
    })();
  }, []);

  // Helper: default date range (last 90 days or start-of-year)
  function getDateRange() {
    const end = dayjs();
    let start;
    if (range === 'ytd') {
      start = dayjs().startOf('year');
    } else {
      start = end.subtract(Number(range) - 1, 'day');
    }
    return { from: start.format('YYYY-MM-DD'), to: end.format('YYYY-MM-DD') };
  }

  // Reset all filters
  function handleReset() {
    setStoreFilter(''); setSelectedStore('');
    setSelectedCategory(''); setSkuFilter('');
    setSelectedSku(''); setRange('90');
    setCustomFrom(''); setCustomTo('');
    setShowCustom(false);
  }

  // Open explanation for an anomaly
  async function handleAnomalyClick(a: Anomaly) {
    setCurrentAnomaly(a);
    setExplainerOpen(true);
    setExplanation('Loading...');
    const params = new URLSearchParams();
    params.append('date', a.date);
    params.append('revenue', a.revenue.toString());
    params.append('delta', a.delta_pct.toString());
    if (selectedSku) params.append('sku', selectedSku);
    else params.append('category', a.category);
    if (selectedStore) params.append('store', selectedStore);
    try {
      const res = await fetch(`/api/anomaly-explain?${params.toString()}`);
      const data = await res.json();
      setExplanation(res.ok ? (data.explanation || 'No explanation available.') : (data.error || 'Error fetching explanation'));
    } catch (e:any) {
      console.error('Anomaly explanation fetch failed', e);
      setExplanation('Failed to fetch explanation.');
    }
  }

  // Fetch dashboard data on filter change
  useEffect(() => {
    (async () => {
      let from:string|undefined, to:string|undefined;
      if (range === 'custom') { from = customFrom; to = customTo; }
      else { ({ from, to } = getDateRange()); }
      if (!from || !to) return;

      const params = new URLSearchParams();
      params.append('from', from); params.append('to', to);
      if (selectedStore)    params.append('store', selectedStore);
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedSku)      params.append('sku', selectedSku);
      const query = `?${params.toString()}`;

      try {
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
        if (!kpiResp.ok) throw new Error(kpiData.error || 'KPIs error');
        if (!catResp.ok) throw new Error(catData.error || 'Top categories error');
        if (!mwResp.ok)  throw new Error(mwData.error  || 'Margin waterfall error');
        if (!skusResp.ok) throw new Error(skusData.error|| 'Top SKUs error');
        if (!anomaliesResp.ok) throw new Error(anomaliesData.error|| 'Anomalies error');

        setKpis(kpiData);
        setCats(catData.rows || []);
        setMarginSteps(mwData.steps || []);
        setTopSkus(skusData.rows || []);
        setAnomalies(anomaliesData.anomalies || []);
        setErr('');
      } catch(e:any) {
        setErr(e.message || 'Failed to load dashboard data.');
      }
    })();
  }, [range, selectedStore, selectedCategory, selectedSku, customFrom, customTo]);

  // Filter store list based on search term
  const filteredStoreList = storeList.filter(s => {
    const term = storeFilter.toLowerCase();
    return s.name?.toLowerCase().includes(term) || s.id.toLowerCase().includes(term);
  });

  return (
    <main className="grid gap-4">
      {/* Header: Title and Filters */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Dashboard</h2>
        <div className="flex gap-2">
          {/* Timeframe selector */}
          <select value={range} onChange={e=>setRange(e.target.value as any)} className="select">
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="ytd">Year to Date</option>
          </select>

          {/* Store search + select */}
          <input
            type="text" value={storeFilter} onChange={e=>setStoreFilter(e.target.value)}
            placeholder="Search store..." className="input w-36"
          />
          <select value={selectedStore} onChange={e=>setSelectedStore(e.target.value)} className="select">
            <option value="">All Stores</option>
            {filteredStoreList.map(s => (
              <option key={s.id} value={s.id}>{s.name || `Store ${s.id}`}</option>
            ))}
          </select>

          {/* Category select */}
          <select value={selectedCategory} onChange={e=>setSelectedCategory(e.target.value)} className="select">
            <option value="">All Categories</option>
            {categoryList.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* SKU search + select */}
          <input
            type="text" value={skuFilter} onChange={e=>setSkuFilter(e.target.value)}
            placeholder="Search SKU..." className="input w-36"
          />
          <select value={selectedSku} onChange={e=>setSelectedSku(e.target.value)} className="select">
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
            >✕</button>
          )}

          {/* Custom range toggle */}
          <button type="button" onClick={() => setShowCustom(true)} className="btn">
            Custom Range
          </button>

          {/* Reset filters */}
          <button type="button" onClick={handleReset} className="btn btn-outline ml-auto">
            Reset Filters
          </button>
        </div>
      </div>

      {/* Custom Date Range Inputs */}
      {showCustom && (
        <div className="flex items-center gap-2 mb-4">
          <input 
            type="date" value={customFrom} 
            onChange={e => setCustomFrom(e.target.value)}
            className="input"
          />
          <span>to</span>
          <input 
            type="date" value={customTo} 
            onChange={e => setCustomTo(e.target.value)}
            className="input"
          />
          <button 
            type="button" className="btn"
            onClick={() => {
              if (customFrom && customTo) {
                setRange('custom');
                setShowCustom(false);
              }
            }}
          >Apply</button>
          <button 
            type="button" className="btn"
            onClick={() => { setShowCustom(false); }}
          >Cancel</button>
        </div>
      )}

      {err && <div className="card text-red-600">{err}</div>}

      {/* KPI Tiles */}
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
          <div className="stat">{((kpis?.gm_pct ?? 0)*100).toFixed(1)}%</div>
        </div>
        <div className="card">
          <div className="label">Units</div>
          <div className="stat">{Math.round(kpis?.units ?? 0).toLocaleString()}</div>
        </div>
      </div>

      {/* Trend Chart with Metric Selector */}
      <div className="card mb-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-semibold">
            {metric==='revenue'&&'Revenue Trend'}
            {metric==='gm_dollar'&&'Gross Margin $ Trend'}
            {metric==='gm_pct'&&'Gross Margin % Trend'}
            {metric==='units'&&'Units Sold Trend'}
          </h2>
          <div className="flex space-x-1">
            <button
              className={`btn btn-sm ${metric==='revenue'?'btn-active':''}`}
              onClick={()=>setMetric('revenue')}
            >Revenue</button>
            <button
              className={`btn btn-sm ${metric==='gm_dollar'?'btn-active':''}`}
              onClick={()=>setMetric('gm_dollar')}
            >GM$</button>
            <button
              className={`btn btn-sm ${metric==='gm_pct'?'btn-active':''}`}
              onClick={()=>setMetric('gm_pct')}
            >GM%</button>
            <button
              className={`btn btn-sm ${metric==='units'?'btn-active':''}`}
              onClick={()=>setMetric('units')}
            >Units</button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={kpis?.series || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tick={{fontSize:12}}
              tickFormatter={d=>dayjs(d).format('MMM D')}
            />
            <YAxis 
              tick={{fontSize:12}}
              tickFormatter={val=>{
                if(metric==='gm_pct') return (Number(val)*100).toFixed(0)+'%';
                if(metric==='revenue'||metric==='gm_dollar') return '$'+Math.round(Number(val)).toLocaleString();
                return Math.round(Number(val)).toLocaleString();
              }}
            />
            <Tooltip 
              formatter={val=>{
                if(metric==='gm_pct') return (Number(val)*100).toFixed(1)+'%';
                if(metric==='revenue'||metric==='gm_dollar') return '$'+Math.round(Number(val)).toLocaleString();
                return Math.round(Number(val)).toLocaleString();
              }}
              labelFormatter={d=>d}
            />
            <Line 
              type="monotone" 
              dataKey={metric} 
              stroke={
                metric==='revenue' ? "#0077b6" :
                metric==='gm_dollar' ? "#52b788" :
                metric==='gm_pct' ? "#ffb703" : "#fb8500"
              }
              strokeWidth={2}
              dot={false}
              activeDot={{ r:5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top Categories and Top SKUs */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Top Categories */}
        <div className="card">
          <div className="h2 mb-3">Top Categories</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="text-left">
                <th className="p-2">Category</th><th className="p-2">Revenue</th>
                <th className="p-2">GM$</th><th className="p-2">GM%</th><th className="p-2">Units</th>
              </tr></thead>
              <tbody>
                {cats.map(c=>(
                  <tr 
                    key={c.category} 
                    className="border-t hover:bg-gray-50 cursor-pointer"
                    onClick={()=>setSelectedCategory(c.category)}
                  >
                    <td className="p-2">{c.category}</td>
                    <td className="p-2">${Math.round(c.rev).toLocaleString()}</td>
                    <td className="p-2">${Math.round(c.gm).toLocaleString()}</td>
                    <td className="p-2">{(c.gm_pct*100).toFixed(1)}%</td>
                    <td className="p-2">{Math.round(c.units).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selectedCategory && (
            <div className="text-sm mt-2">
              <button onClick={()=>setSelectedCategory('')} className="link">
                ← Back to all Categories
              </button>
            </div>
          )}
        </div>
        {/* Top SKUs */}
        <div className="card">
          <div className="h2 mb-3">Top SKUs</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="text-left">
                <th className="p-2">SKU</th><th className="p-2">Revenue</th>
                <th className="p-2">GM$</th><th className="p-2">GM%</th><th className="p-2">Units</th>
              </tr></thead>
              <tbody>
                {topSkus.map(item=>(
                  <tr 
                    key={item.sku} 
                    className="border-t hover:bg-gray-50 cursor-pointer"
                    onClick={()=>setSelectedSku(item.sku)}
                  >
                    <td className="p-2">{item.sku}</td>
                    <td className="p-2">${Math.round(item.revenue).toLocaleString()}</td>
                    <td className="p-2">${Math.round(item.gm_dollar).toLocaleString()}</td>
                    <td className="p-2">{(item.gm_pct*100).toFixed(1)}%</td>
                    <td className="p-2">{Math.round(item.units).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selectedSku && (
            <div className="text-sm mt-2">
              <button onClick={()=>setSelectedSku('')} className="link">
                ← Back to all SKUs
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Margin Waterfall and Anomalies */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <div className="h2 mb-3">Margin Waterfall</div>
          {marginSteps.length===0 ? (
            <p>No data</p>
          ) : (
            <ul className="space-y-2">
              {marginSteps.map(step=>(
                <li key={step.name} className="flex justify-between">
                  <span>{step.name}</span>
                  <span>{step.value>=0? '$' : '-$'}{Math.abs(step.value).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <div className="h2 mb-3">Anomalies</div>
          {anomalies.length===0 ? (
            <p>No anomalies detected in the selected period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="text-left">
                  <th className="p-2">Date</th>
                  <th className="p-2">Category</th>
                  <th className="p-2">Revenue</th>
                  <th className="p-2">Δ vs avg</th>
                </tr></thead>
                <tbody>
                  {anomalies.map((a,idx)=>(
                    <tr 
                      key={idx} 
                      className="border-t hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleAnomalyClick(a)}
                    >
                      <td className="p-2">{a.date}</td>
                      <td className="p-2">
                        <button 
                          onClick={(e)=>{e.stopPropagation(); setSelectedCategory(a.category);}}
                          className="link"
                        >
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

      {/* Explanation Sidebar */}
      {explainerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div 
            className="fixed inset-0 bg-black opacity-50"
            onClick={() => setExplainerOpen(false)}
          />
          <div className="ml-auto bg-white w-80 h-full p-4 overflow-auto">
            <h3 className="text-lg font-semibold mb-2">Anomaly Explanation</h3>
            <div className="text-sm text-gray-800">
              {explanation || 'Loading...'}
            </div>
            <button 
              className="btn btn-sm mt-4" 
              onClick={() => setExplainerOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
