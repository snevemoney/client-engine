"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Play, RotateCcw, X, ChevronRight, ExternalLink } from "lucide-react";
import { useUrlQueryState } from "@/hooks/useUrlQueryState";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { formatDateTimeSafe } from "@/lib/ui/date-safe";
import { normalizePagination } from "@/lib/ui/pagination-safe";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type Job = {
  id: string;
  jobType: string;
  status: string;
  priority: number;
  attempts: number;
  maxAttempts: number;
  sourceType: string | null;
  sourceId: string | null;
  runAfter: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
};

type Summary = {
  queued: number;
  running: number;
  failed: number;
  deadLetter?: number;
  succeeded24h: number;
  staleRunning?: number;
  dueSchedules?: number;
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
    case "dead_letter":
      return <Badge variant="outline" className="text-red-600 border-red-600/50">dead-letter</Badge>;
    case "canceled":
      return <Badge variant="outline" className="text-neutral-500">canceled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function JobsPage() {
  const url = useUrlQueryState();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [pagination, setPagination] = useState(() => normalizePagination(null, 0));
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runLoading, setRunLoading] = useState(false);
  const [tickLoading, setTickLoading] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const { confirm: confirmCancel, dialogProps: cancelDialogProps } = useConfirmDialog();
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);

  const statusFilter = url.getString("status", "");
  const jobTypeFilter = url.getString("jobType", "");
  const search = url.getString("search", "");
  const page = url.getPage();
  const pageSize = url.getPageSize();

  const fetchData = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const runId = ++runIdRef.current;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (jobTypeFilter) params.set("jobType", jobTypeFilter);
    if (search) params.set("search", search);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    try {
      const [listRes, summaryRes] = await Promise.all([
        fetch(`/api/jobs?${params}`, { credentials: "include", signal: controller.signal, cache: "no-store" }),
        fetch("/api/jobs/summary", { credentials: "include", signal: controller.signal, cache: "no-store" }),
      ]);
      if (controller.signal.aborted || runId !== runIdRef.current) return;
      const listData = listRes.ok ? await listRes.json() : null;
      const summaryData = summaryRes.ok ? await summaryRes.json() : null;
      const items = listData?.items ?? [];
      setJobs(Array.isArray(items) ? items : []);
      setPagination(normalizePagination(listData?.pagination, items?.length ?? 0));
      setSummary(summaryData ?? null);
    } catch (e) {
      if (controller.signal.aborted || runId !== runIdRef.current) return;
      if (e instanceof Error && (e.name === "AbortError" || e.message?.includes("aborted"))) return;
      setError(e instanceof Error ? e.message : "Failed to load");
      setJobs([]);
      setPagination(normalizePagination(null, 0));
    } finally {
      if (runId === runIdRef.current) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }, [statusFilter, jobTypeFilter, search, page, pageSize]);

  useEffect(() => {
    void fetchData();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchData]);

  const handleRun = async () => {
    setRunLoading(true);
    try {
      const res = await fetch("/api/jobs/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 10 }) });
      const data = await res.json();
      if (res.ok) void fetchData();
      else toast.error(data?.error ?? "Run failed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunLoading(false);
    }
  };

  const handleRetry = async (id: string) => {
    if (actioningId) return;
    setActioningId(id);
    try {
      const res = await fetch(`/api/jobs/${id}/retry`, { method: "POST" });
      if (res.ok) void fetchData();
      else {
        const d = await res.json().catch(() => null);
        toast.error(d?.error ?? "Retry failed");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setActioningId(null);
    }
  };

  const handleCancel = async (id: string) => {
    const ok = await confirmCancel({ title: "Cancel job", body: "Cancel this job? This cannot be undone.", confirmLabel: "Cancel job", variant: "destructive" });
    if (!ok) return;
    if (actioningId) return;
    setActioningId(id);
    try {
      const res = await fetch(`/api/jobs/${id}/cancel`, { method: "POST" });
      if (res.ok) void fetchData();
      else {
        const d = await res.json().catch(() => null);
        toast.error(d?.error ?? "Cancel failed");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Background job queue. Run jobs manually or view history.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="text-2xl font-semibold text-amber-400">{summary?.queued ?? 0}</div>
          <div className="text-xs text-neutral-500">Queued</div>
        </section>
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="text-2xl font-semibold text-blue-400">{summary?.running ?? 0}</div>
          <div className="text-xs text-neutral-500">Running</div>
        </section>
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="text-2xl font-semibold text-red-400">{summary?.failed ?? 0}</div>
          <div className="text-xs text-neutral-500">Failed</div>
        </section>
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="text-2xl font-semibold text-red-600">{summary?.deadLetter ?? 0}</div>
          <div className="text-xs text-neutral-500">Dead-letter</div>
        </section>
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="text-2xl font-semibold text-emerald-400">{summary?.succeeded24h ?? 0}</div>
          <div className="text-xs text-neutral-500">Succeeded (24h)</div>
        </section>
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="text-2xl font-semibold text-amber-500">{(summary?.staleRunning ?? 0) + (summary?.dueSchedules ?? 0)}</div>
          <div className="text-xs text-neutral-500">Stale + Due</div>
        </section>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="default"
          size="sm"
          onClick={async () => {
            setTickLoading(true);
            try {
              const res = await fetch("/api/jobs/tick", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
              if (res.ok) void fetchData();
              else { const d = await res.json().catch(() => null); toast.error(d?.error ?? "Tick failed"); }
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Tick failed");
            } finally {
              setTickLoading(false);
            }
          }}
          disabled={tickLoading}
          className="gap-2"
        >
          <Play className="w-4 h-4" />
          {tickLoading ? "Ticking…" : "Tick (recover + schedule + run)"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRun}
          disabled={runLoading}
          className="gap-2"
        >
          <Play className="w-4 h-4" />
          {runLoading ? "Running…" : "Run queue (10)"}
        </Button>
        <Link href="/dashboard/job-schedules">
          <Button variant="ghost" size="sm" className="gap-2">
            Schedules
          </Button>
        </Link>
        <Button variant="ghost" size="sm" onClick={() => void fetchData()} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={statusFilter || "all"}
          onChange={(e) => url.setFilter("status", e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="queued">Queued</option>
          <option value="running">Running</option>
          <option value="succeeded">Succeeded</option>
          <option value="failed">Failed</option>
          <option value="dead_letter">Dead-letter</option>
          <option value="canceled">Canceled</option>
        </select>
        <select
          value={jobTypeFilter || "all"}
          onChange={(e) => url.setFilter("jobType", e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
        >
          <option value="all">All types</option>
          <option value="capture_metrics_snapshot">capture_metrics_snapshot</option>
          <option value="capture_operator_score_snapshot">capture_operator_score_snapshot</option>
          <option value="capture_forecast_snapshot">capture_forecast_snapshot</option>
          <option value="run_reminder_rules">run_reminder_rules</option>
          <option value="generate_automation_suggestions">generate_automation_suggestions</option>
        </select>
        <input
          type="search"
          placeholder="Search id/sourceId"
          value={search}
          onChange={(e) => url.setSearch(e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm w-48"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-12 text-center text-neutral-500">Loading…</div>
      ) : error ? (
        <div className="py-12 text-center text-red-400">{error}</div>
      ) : jobs.length === 0 ? (
        <div className="py-12 text-center text-neutral-500">No jobs</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900/80">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-neutral-300">Created</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-300">Type</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-300">Status</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-300">Attempts</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-300">Source</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-300">Run after</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-300">Finished</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-300">Error</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-t border-neutral-800 hover:bg-neutral-900/50">
                  <td className="px-4 py-3 text-neutral-400">{formatDateTimeSafe(j.createdAt)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{j.jobType}</td>
                  <td className="px-4 py-3">{statusBadge(j.status)}</td>
                  <td className="px-4 py-3 font-mono">{j.attempts}/{j.maxAttempts}</td>
                  <td className="px-4 py-3 text-neutral-400">{j.sourceType ?? "—"}{j.sourceId ? `:${j.sourceId}` : ""}</td>
                  <td className="px-4 py-3 text-neutral-400">{formatDateTimeSafe(j.runAfter)}</td>
                  <td className="px-4 py-3 text-neutral-400">{formatDateTimeSafe(j.finishedAt)}</td>
                  <td className="px-4 py-3 text-red-400 max-w-[200px] truncate" title={j.errorMessage ?? undefined}>
                    {j.errorMessage ? j.errorMessage.slice(0, 80) + (j.errorMessage.length > 80 ? "…" : "") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link href={`/dashboard/jobs/${j.id}`}>
                        <Button variant="ghost" size="sm" className="h-8 px-2">
                          View
                        </Button>
                      </Link>
                      {(j.status === "failed" || j.status === "dead_letter") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-amber-400"
                          onClick={() => handleRetry(j.id)}
                          disabled={actioningId === j.id}
                        >
                          <RotateCcw className="w-3 h-3" />
                        </Button>
                      )}
                      {(j.status === "queued" || j.status === "running") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-red-400"
                          onClick={() => handleCancel(j.id)}
                          disabled={actioningId === j.id}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PaginationControls
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={pagination.total}
        totalPages={pagination.totalPages}
        hasNext={pagination.hasNext}
        hasPrev={pagination.hasPrev}
        onPageChange={url.setPage}
        onPageSizeChange={url.setPageSize}
      />
      <ConfirmDialog {...cancelDialogProps} />
    </div>
  );
}
