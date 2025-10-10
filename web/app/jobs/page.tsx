'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import toast from 'react-hot-toast';

type Job = {
  id: string;
  path: string;
  kind: string;
  status: string;
  created_at: string;
  updated_at?: string | null;
};

const STATUSES = ['all', 'queued', 'running', 'done', 'failed'] as const;
type StatusFilter = (typeof STATUSES)[number];

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');

  const setBusy = (id: string, v: boolean) =>
    setBusyIds((prev) => ({ ...prev, [id]: v }));

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/jobs');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load jobs');
      setJobs((json.jobs || []) as Job[]);
    } catch (e: any) {
      setError(e.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.filter((j) => {
      const matchesQuery =
        !q ||
        fileNameFromPath(j.path).toLowerCase().includes(q) ||
        j.kind.toLowerCase().includes(q) ||
        j.id.toLowerCase().includes(q);
      const matchesStatus = status === 'all' || j.status.toLowerCase() === status;
      return matchesQuery && matchesStatus;
    });
  }, [jobs, query, status]);

  const handleRename = async (job: Job) => {
    const current = fileNameFromPath(job.path);
    const newName = window.prompt('Enter new file name (with extension):', current);
    if (!newName || newName === current) return;
    try {
      setBusy(job.id, true);
      const res = await fetch('/api/jobs/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: job.id, newName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Rename failed');
      toast.success('File renamed');
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Error renaming file');
    } finally {
      setBusy(job.id, false);
    }
  };

  const handleDelete = async (job: Job) => {
    if (
      !confirm(
        'Deletion is permanent and related processing will be discontinued. Continue?'
      )
    )
      return;
    try {
      setBusy(job.id, true);
      const res = await fetch('/api/jobs/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: job.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Deletion failed');
      toast.success('Job deleted');
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Error deleting job');
    } finally {
      setBusy(job.id, false);
    }
  };

  const handleRelaunch = async (job: Job) => {
    try {
      setBusy(job.id, true);
      const res = await fetch('/api/jobs/relaunch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: job.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Relaunch failed');
      toast.success('Job relaunched');
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Error relaunching job');
    } finally {
      setBusy(job.id, false);
    }
  };

  if (loading) return <p>Loading jobs...</p>;
  if (error) return <p className="text-red-600">Error: {error}</p>;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Top bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <h2 className="text-xl font-semibold">Files & Jobs</h2>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search files, kind, or ID…"
              className="w-full sm:w-72 rounded-lg border border-gray-200 bg-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">⌘K</span>
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="rounded-lg border border-gray-200 bg-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          <button onClick={fetchJobs} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
            Refresh
          </button>
        </div>
      </div>

      {/* List */}
      <div className="divide-y rounded-xl border bg-white/70 backdrop-blur">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No results. Try a different search or upload a CSV on the Uploads page.
          </div>
        ) : (
          filtered.map((job) => {
            const isBusy = !!busyIds[job.id];
            const name = fileNameFromPath(job.path);
            return (
              <Row
                key={job.id}
                job={job}
                name={name}
                isBusy={isBusy}
                onRename={() => handleRename(job)}
                onRelaunch={() => handleRelaunch(job)}
                onDelete={() => handleDelete(job)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

function Row({
  job,
  name,
  isBusy,
  onRename,
  onRelaunch,
  onDelete,
}: {
  job: Job;
  name: string;
  isBusy: boolean;
  onRename: () => void;
  onRelaunch: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  return (
    <div className="flex items-center justify-between p-3 sm:p-4" ref={containerRef}>
      {/* Left: file + meta */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <StatusDot status={job.status} />
          <p className="truncate font-medium">{name}</p>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span className="inline-flex items-center rou
