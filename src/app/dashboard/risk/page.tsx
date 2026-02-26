"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Play, Check, Clock, X, ExternalLink } from "lucide-react";
import { useUrlQueryState } from "@/hooks/useUrlQueryState";
import { AsyncState } from "@/components/ui/AsyncState";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { formatDateSafe } from "@/lib/ui/date-safe";
import { normalizePagination } from "@/lib/ui/pagination-safe";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

type RiskFlag = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  sourceType: string;
  sourceId: string | null;
  actionUrl: string | null;
  suggestedFix: string | null;
  lastSeenAt: string;
  snoozedUntil: string | null;
};

type RiskSummary = {
  openBySeverity: { low: number; medium: number; high: number; critical: number };
  snoozedCount: number;
  lastRunAt: string | null;
};

function severityColor(s: string): string {
  if (s === "critical") return "bg-red-500/20 text-red-400";
  if (s === "high") return "bg-amber-500/20 text-amber-400";
  if (s === "medium") return "bg-neutral-500/20 text-neutral-300";
  return "bg-neutral-600/20 text-neutral-500";
}

export default function RiskPage() {
  const url = useUrlQueryState();
  const [items, setItems] = useState<RiskFlag[]>([]);
  const [pagination, setPagination] = useState(() => normalizePagination(null, 0));
  const [summary, setSummary] = useState<RiskSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runLoading, setRunLoading] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);

  const statusFilter = url.getString("status", "");
  const severityFilter = url.getString("severity", "");
  const sourceFilter = url.getString("sourceType", "");
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
    if (severityFilter) params.set("severity", severityFilter);
    if (sourceFilter) params.set("sourceType", sourceFilter);
    if (searchDebounced) params.set("search", searchDebounced);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    try {
      const [data, sum] = await Promise.all([
        fetch(`/api/risk?${params}`, { credentials: "include", signal: controller.signal, cache: "no-store" }).then(
          (r) => (r.ok ? r.json() : null)
        ),
        fetch("/api/risk/summary", { credentials: "include", signal: controller.signal, cache: "no-store" }).then(
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
  }, [statusFilter, severityFilter, sourceFilter, searchDebounced, page, pageSize]);

  useEffect(() => {
    void fetchData();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchData]);

  const handleRunRules = async () => {
    setRunLoading(true);
    try {
      const res = await fetch("/api/risk/run-rules", { method: "POST" });
      if (res.ok) void fetchData();
      else {
        const d = await res.json();
        alert(d?.error ?? "Run rules failed");
      }
    } finally {
      setRunLoading(false);
    }
  };

  const handleSnooze = async (id: string, preset: "2d" | "7d") => {
    if (actioningId) return;
    setActioningId(id);
    try {
      const res = await fetch(`/api/risk/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "snooze", preset }),
      });
      if (res.ok) void fetchData();
      else {
        const d = await res.json();
        alert(d?.error ?? "Snooze failed");
      }
    } finally {
      setActioningId(null);
    }
  };

  const handleResolve = async (id: string) => {
    if (actioningId) return;
    setActioningId(id);
    try {
      const res = await fetch(`/api/risk/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve" }),
      });
      if (res.ok) void fetchData();
      else {
        const d = await res.json();
        alert(d?.error ?? "Resolve failed");
      }
    } finally {
      setActioningId(null);
    }
  };

  const handleDismiss = async (id: string) => {
    if (actioningId) return;
    setActioningId(id);
    try {
      const res = await fetch(`/api/risk/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss" }),
      });
      if (res.ok) void fetchData();
      else {
        const d = await res.json();
        alert(d?.error ?? "Dismiss failed");
      }
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Risk Flags</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Unified view of pipeline, delivery, notifications, jobs, and score risks.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRunRules} disabled={runLoading}>
          <Play className="w-4 h-4 mr-1" />
          {runLoading ? "Running…" : "Run Risk Rules"}
        </Button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
            <p className="text-xs text-neutral-500">Critical</p>
            <p className="text-xl font-semibold text-red-400">{summary.openBySeverity.critical ?? 0}</p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
            <p className="text-xs text-neutral-500">High</p>
            <p className="text-xl font-semibold text-amber-400">{summary.openBySeverity.high ?? 0}</p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
            <p className="text-xs text-neutral-500">Medium</p>
            <p className="text-xl font-semibold">{summary.openBySeverity.medium ?? 0}</p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
            <p className="text-xs text-neutral-500">Snoozed</p>
            <p className="text-xl font-semibold">{summary.snoozedCount ?? 0}</p>
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
          <option value="open">Open</option>
          <option value="snoozed">Snoozed</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>
        <select
          value={severityFilter}
          onChange={(e) => url.setFilter("severity", e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm"
        >
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => url.setFilter("sourceType", e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm"
        >
          <option value="">All sources</option>
          <option value="notification_event">Notification</option>
          <option value="job">Job</option>
          <option value="reminder">Reminder</option>
          <option value="score">Score</option>
          <option value="proposal">Proposal</option>
          <option value="delivery_project">Delivery</option>
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
        emptyMessage="No risk flags"
        onRetry={fetchData}
      >
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 overflow-hidden">
          {items.length > 0 ? (
            <div className="divide-y divide-neutral-800">
              {items.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-3 p-4 hover:bg-neutral-800/30">
                  <Badge className={severityColor(r.severity)}>{r.severity}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{r.title}</p>
                    {r.description && <p className="text-xs text-neutral-500 truncate">{r.description}</p>}
                    <div className="flex gap-3 mt-1 text-xs text-neutral-400">
                      <span>{r.sourceType}</span>
                      <span>Last seen: {formatDateSafe(r.lastSeenAt, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      <span>{r.status}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {r.actionUrl && (
                      <Link href={r.actionUrl}>
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </Link>
                    )}
                    {(r.status === "open" || r.status === "snoozed") && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => handleSnooze(r.id, "2d")} disabled={actioningId === r.id}>
                          2d
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleSnooze(r.id, "7d")} disabled={actioningId === r.id}>
                          7d
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleResolve(r.id)} disabled={actioningId === r.id} className="text-emerald-400">
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDismiss(r.id)} disabled={actioningId === r.id} className="text-neutral-400" data-testid="risk-dismiss">
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-neutral-500">No risk flags</div>
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
