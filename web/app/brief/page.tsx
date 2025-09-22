'use client';
import { useEffect, useState } from 'react';
import { marked } from 'marked';

export default function BriefPage() {
  const [brief, setBrief] = useState<any>(null);
  const [err, setErr] = useState('');

  useEffect(()=>{
    (async ()=>{
      try{
        const res = await fetch('/api/brief/latest', { cache: 'no-store' });
        const j = await res.json(); setBrief(j);
      }catch(e:any){ setErr(String(e)); }
    })();
  },[]);

  return (
    <main className="grid gap-4">
      <div className="flex items-center justify-between">
        <div className="h2">Latest Brief</div>
        {brief?.pdf_url && <a className="btn" href={brief.pdf_url} target="_blank">Download PDF</a>}
      </div>
      {err && <pre className="text-red-600">{err}</pre>}
      {brief?.content_md && (
        <article className="card prose max-w-none" dangerouslySetInnerHTML={{ __html: marked.parse(brief.content_md) as string }} />
      )}
    </main>
  );
}
