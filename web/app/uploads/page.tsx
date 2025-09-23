'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function Uploads() {
  const [kind, setKind] = useState('sales');
  const [file, setFile] = useState<File|null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function send() {
    if (!file) { toast.error('Pick a CSV first'); return; }
    setBusy(true);
    setMsg('');
    try {
      const fd = new FormData();
      fd.append('kind', kind);
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Upload failed');
      toast.success(`Queued job #${json.job_id}`);
      setMsg(JSON.stringify(json, null, 2));
    } catch (e:any) {
      toast.error(e.message);
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid gap-4">
      <div className="card">
        <div className="h2 mb-2">Upload CSV</div>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <div className="label">Kind</div>
            <select className="input" value={kind} onChange={e=>setKind(e.target.value)} disabled={busy}>
              <option>sales</option>
              <option>product_master</option>
              <option>store_master</option>
              <option>promo_calendar</option>
            </select>
          </div>
          <div>
            <div className="label">File</div>
            <input className="input" type="file" accept=".csv" onChange={e=>setFile(e.target.files?.[0]||null)} disabled={busy}/>
          </div>
          <div className="flex items-end">
            <button className="btn" onClick={send} disabled={busy}>
              {busy ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </div>
        {msg && <pre className="mt-4 whitespace-pre-wrap">{msg}</pre>}
      </div>

      <div className="card">
        <div className="h2 mb-2">CSV templates</div>
        <ul className="list-disc pl-6">
          <li>sales.csv — date, store_id, sku, product_name, units, net_sales, discount, cost, category, sub_category</li>
          <li>product_master.csv — sku, product_name, category, sub_category, default_cost, status</li>
          <li>store_master.csv — store_id, store_name, region, city, currency, is_active</li>
          <li>promo_calendar.csv — start_date, end_date, promo_name, sku, promo_type, discount_pct</li>
        </ul>
      </div>
    </main>
  );
}
