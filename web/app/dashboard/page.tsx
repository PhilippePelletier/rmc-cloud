'use client';
import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const [data, setData] = useState<any[]>([]);
  const [kpi, setKpi] = useState<any>(null);
  const [err, setErr] = useState<string>('');

  useEffect(()=>{
    (async ()=>{
      try{
        const res = await fetch('/api/kpis', { cache: 'no-store' });
        const j = await res.json();
        setKpi(j.kpis);
        setData(j.trend);
      }catch(e:any){ setErr(String(e)); }
    })();
  },[]);

  return (
    <main className="grid gap-4">
      <div className="card">
        <div className="h2 mb-3">KPIs</div>
        {kpi && <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card"><div className="label">Revenue</div><div className="text-2xl">${Number(kpi.rev).toLocaleString()}</div></div>
          <div className="card"><div className="label">GM%</div><div className="text-2xl">{(kpi.gm_pct*100).toFixed(1)}%</div></div>
          <div className="card"><div className="label">Units</div><div className="text-2xl">{kpi.units}</div></div>
          <div className="card"><div className="label">Discount %</div><div className="text-2xl">{(kpi.disc_pct*100).toFixed(1)}%</div></div>
        </div>}
      </div>
      <div className="card">
        <div className="h2 mb-3">Revenue trend</div>
        <div style={{width:'100%', height:320}}>
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3"/>
              <XAxis dataKey="date"/>
              <YAxis/>
              <Tooltip/>
              <Line type="monotone" dataKey="net_sales"/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      {err && <pre className="text-red-600">{err}</pre>}
    </main>
  );
}
