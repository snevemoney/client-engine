"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, RotateCcw } from "lucide-react";
import { formatDateTimeSafe } from "@/lib/ui/date-safe";

type JobDetail = {
  id: string;
  jobType: string;
  status: string;
  priority: number;
  idempotencyKey: string | null;
  dedupeKey: string | null;
  payloadJson?: object;
  resultJson?: object;
  errorMessage: string | null;
  errorCode: string | null;
  attempts: number;
  maxAttempts: number;
  runAfter: string | null;
  lockedAt: string | null;
  lockOwner: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  sourceType: string | null;
  sourceId: string | null;
  createdAt: string;
  updatedAt: string;
  logs: { id: string; level: string; message: string; metaJson?: object; createdAt: string }[];
};

function statusBadge(status: string) {
  switch (status) {
    case "queued":
      return <Badge variant="outline" className="text-amber-400 border-amber-500/50">queued</Badge>;
    case "running":
      return <Badge variant="outline" className="text-blue-400 border-blue-500/50">running</Badge>;
    case "succeeded":
      return <Badge variant="success">succeeded</Badge>;
    case "failed":
      return <Badge variant="destructive">failed</Badge>;
    case "canceled":
      return <Badge variant="outline" className="text-neutral-500">canceled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/jobs/${id}`, { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setJob(d && typeof d === "object" ? d : null))
      .catch(() => setJob(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleRetry = async () => {
    if (!id || retrying) return;
    setRetrying(true);
    try {
      const res = await fetch(`/api/jobs/${id}/retry`, { method: "POST" });
      if (res.ok) {
        const d = await res.json();
        setJob((prev) => (prev ? { ...prev, status: d.status ?? "queued" } : null));
      } else {
        const d = await res.json();
        alert(d?.error ?? "Retry failed");
      }
    } finally {
      setRetrying(false);
    }
  };

  if (loading || !id) {
    return (
      <div className="space-y-6">
        <div className="py-12 text-center text-neutral-500">Loading…</div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/jobs" className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-200">
          <ChevronLeft className="w-4 h-4" /> Back to Jobs
        </Link>
        <div className="py-12 text-center text-red-400">{error ?? "Job not found"}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href="/dashboard/jobs" className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-200 mb-2">
            <ChevronLeft className="w-4 h-4" /> Back to Jobs
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight font-mono">{job.jobType}</h1>
          <p className="text-sm text-neutral-400 mt-1">ID: {job.id}</p>
        </div>
        <div className="flex items-center gap-2">
          {statusBadge(job.status)}
          {job.status === "failed" && (
            <Button variant="outline" size="sm" onClick={handleRetry} disabled={retrying} className="gap-1">
              <RotateCcw className="w-3 h-3" />
              Retry
            </Button>
          )}
        </div>
      </div>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">Details</h2>
        <dl className="grid gap-2 text-sm">
          <div className="flex gap-2">
            <dt className="text-neutral-500 w-28">Status</dt>
            <dd>{job.status}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-neutral-500 w-28">Attempts</dt>
            <dd>{job.attempts} / {job.maxAttempts}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-neutral-500 w-28">Created</dt>
            <dd>{formatDateTimeSafe(job.createdAt)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-neutral-500 w-28">Started</dt>
            <dd>{formatDateTimeSafe(job.startedAt)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-neutral-500 w-28">Finished</dt>
            <dd>{formatDateTimeSafe(job.finishedAt)}</dd>
          </div>
          {job.errorMessage && (
            <div className="flex gap-2">
              <dt className="text-neutral-500 w-28">Error</dt>
              <dd className="text-red-400">{job.errorMessage}</dd>
            </div>
          )}
        </dl>
      </section>

      {job.payloadJson && Object.keys(job.payloadJson).length > 0 && (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-neutral-300 mb-3">Payload</h2>
          <pre className="text-xs font-mono text-neutral-400 overflow-x-auto p-3 rounded bg-neutral-950">
            {JSON.stringify(job.payloadJson, null, 2)}
          </pre>
        </section>
      )}

      {job.resultJson && Object.keys(job.resultJson).length > 0 && (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-neutral-300 mb-3">Result</h2>
          <pre className="text-xs font-mono text-neutral-400 overflow-x-auto p-3 rounded bg-neutral-950">
            {JSON.stringify(job.resultJson, null, 2)}
          </pre>
        </section>
      )}

      {job.logs && job.logs.length > 0 && (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-neutral-300 mb-3">Logs</h2>
          <ul className="space-y-2">
            {job.logs.map((l) => (
              <li key={l.id} className="text-xs font-mono flex gap-2">
                <span className="text-neutral-500 shrink-0">{formatDateTimeSafe(l.createdAt)}</span>
                <span className={l.level === "error" ? "text-red-400" : l.level === "warn" ? "text-amber-400" : "text-neutral-400"}>
                  [{l.level}]
                </span>
                <span className="text-neutral-300">{l.message}</span>
                {l.metaJson && Object.keys(l.metaJson).length > 0 && (
                  <span className="text-neutral-500"> {JSON.stringify(l.metaJson)}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
