'use client';

import { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';

type Job = {
  id: string;
  path: string;
  kind: string;
  status: string;
  created_at: string;
  updated_at?: string | null;
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});

  const setBusy = (id: string, v: boolean) =>
    setBusyIds((prev) => ({ ...prev, [id]: v }));

  // Fetch jobs via GET /api/jobs
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
      // optimistic update to reflect queued/running status if API returns it
      await fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Error relaunching job');
    } finally {
      setBusy(job.id, false);
    }
  };

  if (loading) return <p>Loading jobs...</p>;
  if (error) return <p className="text-red-600">Error: {error}</p>;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="h2">Uploaded Jobs</h2>
        <button className="btn" onClick={fetchJobs}>Refresh</button>
      </div>

      {jobs.length === 0 ? (
        <p>No jobs found. Upload a CSV on the Uploads page.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="p-2">ID</th>
                <th className="p-2">File Name</th>
                <th className="p-2">Type</th>
                <th className="p-2">Status</th>
                <th className="p-2">Uploaded At</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const fileName = fileNameFromPath(job.path);
                const isBusy = !!busyIds[job.id];
                return (
                  <tr key={job.id} className="border-t">
                    <td className="p-2">{job.id}</td>
                    <td className="p-2">{fileName}</td>
                    <td className="p-2">{job.kind}</td>
                    <td className="p-2">
                      <span
                        className={
                          'inline-flex items-center px-2 py-0.5 rounded text-xs ' +
                          statusClass(job.status)
                        }
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="p-2">
                      {new Date(job.created_at).toLocaleString()}
                    </td>
                    <td className="p-2 space-x-2">
                      <button
                        className="btn text-sm"
                        onClick={() => handleRename(job)}
                        disabled={isBusy}
                      >
                        Rename
                      </button>
                      <button
                        className="btn text-sm"
                        onClick={() => handleRelaunch(job)}
                        disabled={isBusy}
                      >
                        Relaunch
                      </button>
                      <button
                        className="btn text-sm text-red-600"
                        onClick={() => handleDelete(job)}
                        disabled={isBusy}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function fileNameFromPath(path: string) {
  const parts = (path || '').split('/');
  const fileWithTs = parts[parts.length - 1] || '';
  // preserve everything after the first hyphen so renames keep the user-facing filename
  return fileWithTs.includes('-')
    ? fileWithTs.substring(fileWithTs.indexOf('-') + 1)
    : fileWithTs;
}

function statusClass(status: string) {
  const s = (status || '').toLowerCase();
  if (s === 'done') return 'bg-green-100 text-green-800';
  if (s === 'failed') return 'bg-red-100 text-red-800';
  if (s === 'running') return 'bg-blue-100 text-blue-800';
  if (s === 'queued' || s === 'pending') return 'bg-amber-100 text-amber-800';
  return 'bg-gray-100 text-gray-800';
}

  );
}
