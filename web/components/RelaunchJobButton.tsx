// components/RelaunchJobButton.tsx
'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RelaunchJobButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onRelaunch = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/jobs/relaunch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(`Failed to relaunch: ${json.error ?? "unknown error"}`);
      } else {
        // Optional: show whether the worker was pinged successfully
        if (!json.worker_ok) {
          console.warn("Worker did not acknowledge the relaunch immediately.");
        }
        // Revalidate data on the page
        router.refresh();
      }
    } catch (e: any) {
      alert(`Error: ${e?.message ?? e}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      className="btn"
      onClick={onRelaunch}
      disabled={loading}
      title="Re-queue this job and notify the worker"
    >
      {loading ? "Relaunching…" : "Relaunch"}
    </button>
  );
}
