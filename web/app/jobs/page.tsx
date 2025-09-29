'use client';
import { useEffect, useState, useCallback } from 'react';
import dayjs from 'dayjs';

type Job = {
  id: string;
  kind: string;
  status: string;
  message: string | null;
  created_at: string;
  updated_at: string;
};

export default function Jobs() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [err, setErr] = useState('');
  const [launching, setLaunching] = useState<Record<string, boolean>>({});

  const loadJobs = useCallback(async () => {
    try {
      setErr('');
      const res = await fetch('/api/jobs', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load jobs');
      setJobs((data.jobs || []) as Job[]);
    } catch (e: any) {
      setErr(e.message || String(e));
      setJobs([]);
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const relaunch = async (id: string) => {
    try {
      // mark this row as busy
      setLaunching(prev => ({ ...prev, [id]: true }));

      // optimistic UI: update the row locally
      setJobs(prev =>
        (prev || []).map(j =>
          j.id === id
            ? {
                ...j,
                status: 'queued',
                message: null,
                updated_at: new Date().toISOString(),
              }
            : j
        )
      );

      const res = await fetch('/api/jobs/relaunch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) {
        // revert optimistic update on error
        await loadJobs();
        throw new Error(json.error || 'Failed to relaunch job');
      }

      // (optional) if worker didn’t ack immediately, we still keep it queued
      // you can surface json.worker_ok if you want to display a subtle warning

      // re-sync from server to be safe
      await loadJobs();
    } catch (e: any) {
      alert(e.message || String(e));
    } finally {
      setLaunching(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  return (
    <main className="grid gap-4">
      <div className="h2">Recent Jobs</div>

      {err && <div className="card text-red-600">{err}</div>}

      {!err && jobs === null && (
        <div className="text-sm text-gray-600">Loading jobs...</div>
      )}

      {!err && jobs !== null && jobs.length === 0 && (
        <div className="card">No jobs found.</div>
      )}

      {jobs && jobs.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="p-2">ID</th>
                <th className="p-2">Kind</th>
                <th className="p-2">Status</th>
                <th className="p-2">Created</th>
                <th className="p-2">Updated</th>
                <th className="p-2">Message</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-t">
                  <td className="p-2">{j.id}</td>
                  <td className="p-2">{j.kind}</td>
                  <td className="p-2">{j.status}</td>
                  <td className="p-2">
                    {dayjs(j.created_at).format('YYYY-MM-DD HH:mm')}
                  </td>
                  <td className="p-2">
                    {dayjs(j.updated_at).format('YYYY-MM-DD HH:mm')}
                  </td>
                  <td className="p-2">{j.message || ''}</td>
                  <td className="p-2">
                    <button
                      className="btn"
                      onClick={() => relaunch(j.id)}
                      disabled={!!launching[j.id]}
                      title="Re-queue this job and notify the worker"
                    >
                      {launching[j.id] ? 'Relaunching…' : 'Relaunch'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
