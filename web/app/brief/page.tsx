'use client';
import { useEffect, useState } from 'react';
import { marked } from 'marked';

export default function BriefPage() {
  const [brief, setBrief] = useState<any | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/brief/latest', { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load brief');
        setBrief(data);
      } catch (e: any) {
        setErr(e.message || String(e));
      }
    })();
  }, []);

  return (
    <main className="grid gap-4">
      <div className="flex items-center justify-between">
        <div className="h2">Latest Brief</div>
        {brief?.pdf_url && (
          <a className="btn" href={brief.pdf_url} target="_blank" rel="noreferrer">
            Download PDF
          </a>
        )}
      </div>

      {err && <div className="text-red-600">{err}</div>}
      {!err && brief === null && (
        <div className="text-sm text-gray-600">Loading brief...</div>
      )}
      {brief?.content_md && (
        <article
          className="card prose max-w-none"
          dangerouslySetInnerHTML={{ __html: marked.parse(brief.content_md) }}
        />
      )}
    </main>
  );
}
