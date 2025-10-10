'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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

  async function fetchJobs() {
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
  }

  useEffect(() => {
    fetchJobs();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.filter((j) => {
      const name = fileNameFromPath(j.path).toLowerCase();
      const matchesQuery =
        !q || name.includes(q) || j.kind.toLowerCase().includes(q) || j.id.toLowerCase().includes(q);
      const matchesStatus = status === 'all' || j.status.toLowerCase() === status;
      return matchesQuery && matchesStatus;
    });
  }, [jobs, query, status]);

  async function handleRename(job: Job) {
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
  }

  async function handleDelete(job: Job) {
    const ok = window.confirm(
      'Deletion is permanent and related processing will be discontinued. Continue?'
    );
    if (!ok) return;
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
  }

  async function handleRelaunch(job: Job) {
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
  }

  if (loading) return <p>Loading jobs...</p>;
  if (error) return <p className="text-red-600">Error: {error}</p>;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Top bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">Files &amp; Jobs</h2>
        <div className="flex w-full gap-2 sm:w-auto">
          <div className="relative flex-1">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search files, kind, or ID…"
              className="w-full rounded-lg border border-gray-200 bg-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 sm:w-72"
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              ⌘K
            </span>
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
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => {
      document.removeEventListener('click', onDocClick);
    };
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
          <span className="inline-flex items-center rounded-full border px-2 py-0.5">{job.kind}</span>
          <span>•</span>
          <span>ID: {job.id}</span>
          <span>•</span>
          <span>Uploaded {timeAgo(job.created_at)}</span>
          {job.updated_at ? (
            <>
              <span>•</span>
              <span>Updated {timeAgo(job.updated_at)}</span>
            </>
          ) : null}
        </div>
      </div>

      {/* Right: status + menu */}
      <div className="ml-4 flex items-center gap-3">
        <StatusPill status={job.status} />
        <div className="relative">
          <button
            className="rounded-lg border px-2 py-1 text-sm hover:bg-gray-50"
            onClick={() => setMenuOpen((v) => !v)}
            disabled={isBusy}
            aria-label="Actions"
            title="Actions"
            type="button"
          >
            ⋮
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-20 mt-2 w-40 overflow-hidden rounded-lg border bg-white shadow-lg">
              <MenuItem onClick={() => { setMenuOpen(false); onRename(); }}>Rename</MenuItem>
              <MenuItem onClick={() => { setMenuOpen(false); onRelaunch(); }}>Relaunch</MenuItem>
              <MenuItem destructive onClick={() => { setMenuOpen(false); onDelete(); }}>
                Delete
              </MenuItem>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  destructive,
}: {
  children: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ' +
        (destructive ? 'text-red-600 hover:text-red-700' : '')
      }
    >
      {children}
    </button>
  );
}

function StatusDot({ status }: { status: string }) {
  const cls =
    'h-2.5 w-2.5 rounded-full ' +
    (status === 'done'
      ? 'bg-green-500'
      : status === 'failed'
      ? 'bg-red-500'
      : status === 'running'
      ? 'bg-blue-500'
      : status === 'queued' || status === 'pending'
      ? 'bg-amber-500'
      : 'bg-gray-300');
  return <span className={cls} />;
}

function StatusPill({ status }: { status: string }) {
  const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ';
  const cls =
    status === 'done'
      ? base + 'bg-green-100 text-green-800'
      : status === 'failed'
      ? base + 'bg-red-100 text-red-800'
      : status === 'running'
      ? base + 'bg-blue-100 text-blue-800'
      : status === 'queued' || status === 'pending'
      ? base + 'bg-amber-100 text-amber-800'
      : base + 'bg-gray-100 text-gray-800';
  return <span className={cls}>{status}</span>;
}

function fileNameFromPath(path: string) {
  const parts = (path || '').split('/');
  const fileWithTs = parts[parts.length - 1] || '';
  return fileWithTs.includes('-')
    ? fileWithTs.substring(fileWithTs.indexOf('-') + 1)
    : fileWithTs;
}

function timeAgo(iso?: string | null) {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.max(1, Math.floor((now - then) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  const y = Math.floor(mo / 12);
  return `${y}y ago`;
}
