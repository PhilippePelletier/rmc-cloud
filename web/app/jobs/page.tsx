'use client';
import { useEffect, useState } from 'react';
import dayjs from 'dayjs';

export default function Jobs() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [err, setErr] = useState('');

  useEffect(()=>{ (async()=>{
    try{
      const r = await fetch('/api/jobs', { cache:'no-store' });
      const j = await r.json();
      if(!r.ok) throw new Error(j.error||'Failed to load jobs');
      setJobs(j.jobs||[]);
    }catch(e:any){ setErr(String(e)); }
  })(); },[]);

  return (
    <main className="grid gap-4">
      <div className="h2">Recent Jobs</div>
      {err && <div className="card text-red-600">{err}</div>}
      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="text-left">
            <th className="p-2">ID</th><th className="p-2">Kind</th><th className="p-2">Status</th>
            <th className="p-2">Created</th><th className="p-2">Updated</th><th className="p-2">Message</th>
          </tr></thead>
          <tbody>
            {jobs.map(j=>(
              <tr key={j.id} className="border-t">
                <td className="p-2">{j.id}</td>
                <td className="p-2">{j.kind}</td>
                <td className="p-2">{j.status}</td>
                <td className="p-2">{dayjs(j.created_at).format('YYYY-MM-DD HH:mm')}</td>
                <td className="p-2">{dayjs(j.updated_at).format('YYYY-MM-DD HH:mm')}</td>
                <td className="p-2">{j.message||''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
