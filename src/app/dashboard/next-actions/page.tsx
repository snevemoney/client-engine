"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Play, Check, X, ExternalLink } from "lucide-react";
import { useUrlQueryState } from "@/hooks/useUrlQueryState";
import { AsyncState } from "@/components/ui/AsyncState";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { formatDateSafe } from "@/lib/ui/date-safe";
import { normalizePagination } from "@/lib/ui/pagination-safe";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

type NextAction = {
  id: string;
  title: string;
  reason: string | null;
  priority: string;
  score: number;
  status: string;
  sourceType: string;
  sourceId: string | null;
  actionUrl: string | null;
  createdAt: string;
};

type NBASummary = {
  top5: Array<{ id: string; title: string; reason: string | null; priority: string; score: number; actionUrl: string | null; sourceType: string }>;
  queuedByPriority: { low: number; medium: number; high: number; critical: number };
  lastRunAt: string | null;
};

function priorityColor(p: string): string {
  if (p === "critical") return "bg-red-500/20 text-red-400";
  if (p === "high") return "bg-amber-500/20 text-amber-400";
  if (p === "medium") return "bg-neutral-500/20 text-neutral-300";
  return "bg-neutral-600/20 text-neutral-500";
}

export default function NextActionsPage() {
  const url = useUrlQueryState();
  const [items, setItems] = useState<NextAction[]>([]);
  const [pagination, setPagination] = useState(() => normalizePagination(null, 0));
  const [summary, setSummary] = useState<NBASummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runLoading, setRunLoading] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);

  const statusFilter = url.getString("status", "");
  const priorityFilter = url.getString("priority", "");
  const searchRaw = url.getString("search", "");
  const searchDebounced = useDebouncedValue(searchRaw, 300);
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
    if (priorityFilter) params.set("priority", priorityFilter);
    if (searchDebounced) params.set("search", searchDebounced);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    try {
      const [data, sum] = await Promise.all([
        fetch(`/api/next-actions?${params}`, { credentials: "include", signal: controller.signal, cache: "no-store" }).then(
          (r) => (r.ok ? r.json() : null)
        ),
        fetch("/api/next-actions/summary", { credentials: "include", signal: controller.signal, cache: "no-store" }).then(
          (r) => (r.ok ? r.json() : null)
        ),
      ]);
      if (controller.signal.aborted || runId !== runIdRef.current) return;
      const list = data?.items ?? [];
      setItems(Array.isArray(list) ? list : []);
      setPagination(normalizePagination(data?.pagination, list?.length ?? 0));
      setSummary(sum ?? null);
    } catch (e) {
      if (controller.signal.aborted || runId !== runIdRef.current) return;
      if (e instanceof Error && (e.name === "AbortError" || e.message?.includes("aborted"))) return;
      setError(e instanceof Error ? e.message : "Failed to load");
      setItems([]);
      setPagination(normalizePagination(null, 0));
    } finally {
      if (runId === runIdRef.current) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }, [statusFilter, priorityFilter, searchDebounced, page, pageSize]);

  useEffect(() => {
    void fetchData();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchData]);

  const handleRun = async () => {
    setRunLoading(true);
    try {
      const res = await fetch("/api/next-actions/run", { method: "POST" });
      if (res.ok) void fetchData();
      else {
        const d = await res.json();
        toast.error(d?.error ?? "Run failed");
      }
    } finally {
      setRunLoading(false);
    }
  };

  const handleDone = async (id: string) => {
    if (actioningId) return;
    setActioningId(id);
    try {
      const res = await fetch(`/api/next-actions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "done" }),
      });
      if (res.ok) void fetchData();
      else {
        const d = await res.json();
        toast.error(d?.error ?? "Mark done failed");
      }
    } finally {
      setActioningId(null);
    }
  };

  const handleDismiss = async (id: string) => {
    if (actioningId) return;
    setActioningId(id);
    try {
      const res = await fetch(`/api/next-actions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss" }),
      });
      if (res.ok) void fetchData();
      else {
        const d = await res.json();
        toast.error(d?.error ?? "Dismiss failed");
      }
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Next Best Actions</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Ranked recommendations. Run to refresh from current app state.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRun} disabled={runLoading}>
          <Play className="w-4 h-4 mr-1" />
          {runLoading ? "Running…" : "Run Next Actions"}
        </Button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
            <p className="text-xs text-neutral-500">Critical</p>
            <p className="text-xl font-semibold text-red-400">{summary.queuedByPriority.critical ?? 0}</p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
            <p className="text-xs text-neutral-500">High</p>
            <p className="text-xl font-semibold text-amber-400">{summary.queuedByPriority.high ?? 0}</p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
            <p className="text-xs text-neutral-500">Medium</p>
            <p className="text-xl font-semibold">{summary.queuedByPriority.medium ?? 0}</p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
            <p className="text-xs text-neutral-500">Queued</p>
            <p className="text-xl font-semibold">
              {(summary.queuedByPriority.low ?? 0) + (summary.queuedByPriority.medium ?? 0) + (summary.queuedByPriority.high ?? 0) + (summary.queuedByPriority.critical ?? 0)}
            </p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
            <p className="text-xs text-neutral-500">Last run</p>
            <p className="text-sm text-neutral-400 truncate">
              {summary.lastRunAt ? formatDateSafe(summary.lastRunAt, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <select
          value={statusFilter}
          onChange={(e) => url.setFilter("status", e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          <option value="queued">Queued</option>
          <option value="done">Done</option>
          <option value="dismissed">Dismissed</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => url.setFilter("priority", e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm"
        >
          <option value="">All priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <input
          type="search"
          placeholder="Search…"
          value={searchRaw}
          onChange={(e) => url.setFilter("search", e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm w-40"
        />
        <Button variant="ghost" size="sm" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-1" />
          Refresh
        </Button>
      </div>

      <AsyncState
        loading={loading}
        error={error}
        empty={!loading && !error && items.length === 0}
        emptyMessage="No next actions"
        onRetry={fetchData}
      >
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 overflow-hidden">
          {items.length > 0 ? (
            <div className="divide-y divide-neutral-800">
              {items.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-3 p-4 hover:bg-neutral-800/30">
                  <Badge className={priorityColor(a.priority)}>{a.priority}</Badge>
                  <span className="text-xs text-neutral-500 w-8">{a.score}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{a.title}</p>
                    {a.reason && <p className="text-xs text-neutral-500 truncate">{a.reason}</p>}
                    <div className="flex gap-3 mt-1 text-xs text-neutral-400">
                      <span>{a.sourceType}</span>
                      <span>{a.status}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {a.actionUrl && (
                      <Link href={a.actionUrl}>
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </Link>
                    )}
                    {a.status === "queued" && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => handleDone(a.id)} disabled={actioningId === a.id} className="text-emerald-400">
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDismiss(a.id)} disabled={actioningId === a.id} className="text-neutral-400" data-testid="next-action-dismiss">
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-neutral-500">No next actions</div>
          )}
        </div>
        {pagination.totalPages > 1 || pagination.total > pagination.pageSize ? (
          <div className="mt-3 px-3 pb-3">
            <PaginationControls
              page={pagination.page}
              pageSize={pagination.pageSize}
              total={pagination.total}
              totalPages={pagination.totalPages}
              hasNext={pagination.hasNext}
              hasPrev={pagination.hasPrev}
              onPageChange={url.setPage}
              onPageSizeChange={url.setPageSize}
              isLoading={loading}
            />
          </div>
        ) : null}
      </AsyncState>
    </div>
  );
}
