'use client';
import { useState } from 'react';

export default function Uploads() {
  const [kind, setKind] = useState('sales');
  const [file, setFile] = useState<File|null>(null);
  const [msg, setMsg] = useState('');

  async function send() {
    if (!file) return;
    const fd = new FormData();
    fd.append('kind', kind);
    fd.append('file', file);
    const res = await fetch('/api/upload', { method:'POST', body: fd });
    const json = await res.json();
    setMsg(JSON.stringify(json, null, 2));
  }

  return (
    <main className="grid gap-4">
      <div className="card">
        <div className="h2 mb-2">Upload CSV</div>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <div className="label">Kind</div>
            <select className="input" value={kind} onChange={e=>setKind(e.target.value)}>
              <option>sales</option>
              <option>product_master</option>
              <option>store_master</option>
              <option>promo_calendar</option>
            </select>
          </div>
          <div>
            <div className="label">File</div>
            <input className="input" type="file" onChange={e=>setFile(e.target.files?.[0]||null)}/>
          </div>
          <div className="flex items-end">
            <button className="btn" onClick={send}>Upload</button>
          </div>
        </div>
        {msg && <pre className="mt-4 whitespace-pre-wrap">{msg}</pre>}
      </div>
      <div className="card">
        <div className="h2">CSV templates</div>
        <ul className="list-disc pl-6">
          <li>sales.csv</li><li>product_master.csv</li><li>store_master.csv</li><li>promo_calendar.csv</li>
        </ul>
      </div>
    </main>
  );
}
