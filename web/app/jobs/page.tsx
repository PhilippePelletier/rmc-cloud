'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

/* ----------------------------------------------------------------------------
   Types
---------------------------------------------------------------------------- */
type Job = {
  id: string;
  path: string;
  kind: string;
  status: string;
  created_at: string;
  updated_at?: string | null;
  // If your API starts returning this, we'll prefer it:
  display_name?: string | null;

  // NEW (non-breaking): used for folder filtering and drag-to-file
  folder_id?: string | null;
};

type FolderRow = {
  id: string;
  name: string;
};

const STATUSES = ['all', 'queued', 'running', 'done', 'failed'] as const;
type StatusFilter = (typeof STATUSES)[number];

/* ----------------------------------------------------------------------------
   Page
---------------------------------------------------------------------------- */
export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');

  // NEW: folders
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [activeFolder, setActiveFolder] = useState<'ALL' | 'UNFILED' | string>('ALL');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // If you have group/org in session, wire it here. Safe fallback ''.
  const groupId = '';

  const setBusy = (id: string, v: boolean) =>
    setBusyIds((prev) => ({ ...prev, [id]: v }));

  /* ----------------------------------------
     Fetchers
  ---------------------------------------- */
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

  async function fetchFolders() {
    try {
      const res = await fetch(`/api/folders/list?group_id=${encodeURIComponent(groupId)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load folders');
      setFolders((json.folders || []) as FolderRow[]);
    } catch (e: any) {
      // Non-fatal to the jobs page
      console.warn(e?.message || e);
    }
  }

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    // load folders once (or whenever groupId changes)
    fetchFolders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  /* ----------------------------------------
     Derived list
  ---------------------------------------- */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.filter((j) => {
      const name = displayName(j).toLowerCase();
      const matchesQuery =
        !q || name.includes(q) || j.kind.toLowerCase().includes(q);
      const matchesStatus = status === 'all' || j.status.toLowerCase() === status;

      const matchesFolder =
        activeFolder === 'ALL'
          ? true
          : activeFolder === 'UNFILED'
          ? !j.folder_id
          : j.folder_id === activeFolder;

      return matchesQuery && matchesStatus && matchesFolder;
    });
  }, [jobs, query, status, activeFolder]);

  /* ----------------------------------------
     Actions (keep your existing ones)
  ---------------------------------------- */
  async function handleRename(job: Job) {
    const current = displayName(job);
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

      // Optimistic/local update (works if your API returns either path or displayName)
      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id
            ? {
                ...j,
                path: typeof json.path === 'string' ? json.path : j.path,
                display_name:
                  typeof json.displayName === 'string' ? json.displayName : newName,
              }
            : j
        )
      );

      toast.success('File renamed');
      // Still refresh from server to be 100% consistent with backend
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

      toast.success('Deleted');
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
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

  /* ----------------------------------------
     NEW: Folder CRUD + DnD move
  ---------------------------------------- */
  async function createFolder() {
    if (!newFolderName.trim()) return;
    try {
      const res = await fetch('/api/folders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName.trim(), group_id: groupId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create folder');
      setFolders((prev) => [...prev, json.folder]);
      setCreatingFolder(false);
      setNewFolderName('');
      toast.success('Folder created');
    } catch (e: any) {
      toast.error(e?.message || 'Folder creation failed');
    }
  }

  function onDragStart(e: React.DragEvent, job: Job) {
    e.dataTransfer.setData('text/plain', job.id);
    e.dataTransfer.effectAllowed = 'move';
  }

  function allowDrop(e: React.DragEvent) {
    e.preventDefault();
  }

  async function onDropToFolder(e: React.DragEvent, folderId: string | null) {
    e.preventDefault();
    const jobId = e.dataTransfer.getData('text/plain');
    if (!jobId) return;
    try {
      const res = await fetch('/api/jobs/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId, folder_id: folderId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Move failed');

      // local update
      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, folder_id: folderId } : j)));
      toast.success(folderId ? 'Moved to folder' : 'Removed from folder');
    } catch (e: any) {
      toast.error(e?.message || 'Move failed');
    }
  }

  /* ----------------------------------------
     Render
  ---------------------------------------- */
  if (loading) return <p>Loading jobs...</p>;
  if (error) return <p className="text-red-600">Error: {error}</p>;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Top bar (unchanged) */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">Files &amp; Jobs</h2>
        <div className="flex w-full gap-2 sm:w-auto">
          <div className="relative flex-1">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search files or type…"
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

      {/* New layout: sidebar + list */}
      <div className="grid grid-cols-12 gap-4">
        {/* Sidebar: folders (hidden on small if you want; currently visible) */}
        <aside className="col-span-12 md:col-span-4 lg:col-span-3">
          <div className="rounded-xl border bg-white/70 backdrop-blur p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Folders</h3>
              <button
                onClick={() => setCreatingFolder((v) => !v)}
                className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                type="button"
              >
                New
              </button>
            </div>

            {/* Built-in buckets */}
            <ul className="space-y-1 mb-2">
              {[
                { id: 'ALL', label: 'All' },
                { id: 'UNFILED', label: 'Unfiled' },
              ].map((b) => (
                <li key={b.id}>
                  <button
                    onClick={() => setActiveFolder(b.id as any)}
                    onDragOver={allowDrop}
                    onDrop={(e) => onDropToFolder(e, b.id === 'UNFILED' ? null : null)}
                    className={`w-full text-left rounded-md px-2 py-1 text-sm hover:bg-gray-50 ${
                      activeFolder === b.id ? 'bg-gray-100' : ''
                    }`}
                    type="button"
                  >
                    {b.label}
                  </button>
                </li>
              ))}
            </ul>

            {/* User folders */}
            <ul className="space-y-1">
              {folders.map((f) => (
                <li key={f.id}>
                  <button
                    onClick={() => setActiveFolder(f.id)}
                    onDragOver={allowDrop}
                    onDrop={(e) => onDropToFolder(e, f.id)}
                    className={`w-full text-left rounded-md px-2 py-1 text-sm hover:bg-gray-50 ${
                      activeFolder === f.id ? 'bg-gray-100' : ''
                    }`}
                    type="button"
                  >
                    {f.name}
                  </button>
                </li>
              ))}
            </ul>

            {creatingFolder && (
              <div className="mt-3 space-y-2">
                <input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full rounded-md border px-2 py-1 text-sm"
                  placeholder="Folder name"
                />
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                    type="button"
                    onClick={() => setCreatingFolder(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="rounded-md border bg-black px-2 py-1 text-xs text-white"
                    type="button"
                    onClick={createFolder}
                  >
                    Create
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Jobs list (your original list, now filtered by folder) */}
        <section className="col-span-12 md:col-span-8 lg:col-span-9">
          <div className="divide-y rounded-xl border bg-white/70 backdrop-blur">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No results. Try a different search or upload a CSV on the Uploads page.
              </div>
            ) : (
              filtered.map((job) => {
                const isBusy = !!busyIds[job.id];
                const name = displayName(job);
                return (
                  <Row
                    key={job.id}
                    job={job}
                    name={name}
                    isBusy={isBusy}
                    onRename={() => handleRename(job)}
                    onRelaunch={() => handleRelaunch(job)}
                    onDelete={() => handleDelete(job)}
                    // NEW: make each row draggable
                    draggable
                    onDragStart={(e) => onDragStart(e, job)}
                  />
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Row + UI bits (kept, extended with optional drag props)
---------------------------------------------------------------------------- */
function Row({
  job,
  name,
  isBusy,
  onRename,
  onRelaunch,
  onDelete,
  draggable = false,
  onDragStart,
}: {
  job: Job;
  name: string;
  isBusy: boolean;
  onRename: () => void;
  onRelaunch: () => void;
  onDelete: () => void;
  // NEW (non-breaking): allow drag
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  return (
    <div
      className="flex items-center justify-between p-3 sm:p-4"
      ref={containerRef}
      draggable={draggable}
      onDragStart={onDragStart}
    >
      {/* Left: status dot + name (ID hidden) */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <StatusDot status={job.status} />
          <p className="truncate font-medium">{name}</p>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span className="inline-flex items-center rounded-full border px-2 py-0.5">{job.kind}</span>
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
            <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-lg border bg-white shadow-lg">
              <MenuItem onClick={() => { setMenuOpen(false); onRename(); }}>Rename</MenuItem>
              <MenuItem onClick={() => { setMenuOpen(false); onRelaunch(); }}>Relaunch</MenuItem>
              <div className="my-1 h-px bg-gray-100" />
              <MenuItem onClick={() => { setMenuOpen(false); setShowDetails(true); }}>
                Advanced…
              </MenuItem>
              <MenuItem destructive onClick={() => { setMenuOpen(false); onDelete(); }}>
                Delete
              </MenuItem>
            </div>
          )}
        </div>
      </div>

      {/* Details modal (Advanced) */}
      {showDetails && (
        <DetailsModal
          onClose={() => setShowDetails(false)}
          job={job}
          displayName={name}
        />
      )}
    </div>
  );
}

function DetailsModal({
  onClose,
  job,
  displayName,
}: {
  onClose: () => void;
  job: Job;
  displayName: string;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md rounded-2xl border bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">File details</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-2 py-1 text-sm hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <RowKV label="Name">
            <span className="font-medium">{displayName}</span>
          </RowKV>
          <RowKV label="Type">{job.kind}</RowKV>
          <RowKV label="Status"><StatusPill status={job.status} /></RowKV>
          <RowKV label="Created">{new Date(job.created_at).toLocaleString()}</RowKV>
          {job.updated_at && <RowKV label="Updated">{new Date(job.updated_at).toLocaleString()}</RowKV>}
          <RowKV label="Path">
            <code className="break-all">{job.path}</code>
            <CopyBtn value={job.path} className="ml-2" />
          </RowKV>
          <RowKV label="ID">
            <code className="break-all">{job.id}</code>
            <CopyBtn value={job.id} className="ml-2" />
          </RowKV>
        </div>
      </div>
    </div>
  );
}

function RowKV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-24 shrink-0 text-gray-500">{label}</div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function CopyBtn({ value, className = '' }: { value: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value);
        toast.success('Copied');
      }}
      className={`rounded-md border px-2 py-1 text-xs hover:bg-gray-50 ${className}`}
    >
      Copy
    </button>
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

function displayName(job: Job) {
  if (job.display_name && job.display_name.trim()) return job.display_name.trim();
  return fileNameFromPath(job.path);
}

function fileNameFromPath(path: string) {
  const parts = (path || '').split('/');
  const fileWithTs = parts[parts.length - 1] || '';
  // if backend prefixes "{timestamp}-{name}"
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
