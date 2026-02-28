"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Play, Plus, Check, Clock, X, ExternalLink } from "lucide-react";
import { useUrlQueryState } from "@/hooks/useUrlQueryState";
import { AsyncState } from "@/components/ui/AsyncState";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { formatDateSafe } from "@/lib/ui/date-safe";
import { normalizePagination } from "@/lib/ui/pagination-safe";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { fetchJsonThrow } from "@/lib/http/fetch-json";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type Reminder = {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueAt: string | null;
  snoozedUntil: string | null;
  actionUrl: string | null;
  suggestedAction: string | null;
  createdAt: string;
};

type Summary = {
  open: number;
  overdue: number;
  today: number;
  highPriority: number;
  doneThisWeek: number;
};

function priorityColor(p: string): string {
  if (p === "critical") return "bg-red-500/20 text-red-400";
  if (p === "high") return "bg-amber-500/20 text-amber-400";
  if (p === "medium") return "bg-neutral-500/20 text-neutral-300";
  return "bg-neutral-600/20 text-neutral-500";
}

const toastFn = (m: string, t?: "success" | "error") => t === "error" ? toast.error(m) : toast.success(m);

export default function RemindersPage() {
  const url = useUrlQueryState();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [pagination, setPagination] = useState(() => normalizePagination(null, 0));
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const { confirm, dialogProps } = useConfirmDialog();

  const bucket = url.getString("bucket", "");
  const statusFilter = url.getString("status", "");
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
    if (bucket) params.set("bucket", bucket);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    try {
      const [data, sum] = await Promise.all([
        fetch(`/api/reminders?${params}`, { credentials: "include", signal: controller.signal, cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
        fetch("/api/reminders/summary", { credentials: "include", signal: controller.signal, cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      ]);
      if (controller.signal.aborted || runId !== runIdRef.current) return;
      const items = data?.items ?? data?.reminders ?? [];
      setReminders(Array.isArray(items) ? items : []);
      setPagination(normalizePagination(data?.pagination, items?.length ?? 0));
      setSummary(sum ?? null);
    } catch (e) {
      if (controller.signal.aborted || runId !== runIdRef.current) return;
      if (e instanceof Error && (e.name === "AbortError" || e.message?.includes("aborted"))) return;
      setError(e instanceof Error ? e.message : "Failed to load");
      setReminders([]);
      setPagination(normalizePagination(null, 0));
    } finally {
      if (runId === runIdRef.current) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }, [bucket, statusFilter, page, pageSize]);

  useEffect(() => {
    void fetchData();
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [fetchData]);

  const runRules = useAsyncAction(
    async () => {
      await fetchJsonThrow("/api/reminders/run-rules", { method: "POST" });
      void fetchData();
    },
    { toast: toastFn, successMessage: "Rules executed" }
  );

  const createReminder = useAsyncAction(
    async () => {
      if (!newTitle.trim()) return;
      await fetchJsonThrow("/api/reminders", {
        method: "POST",
        body: JSON.stringify({ title: newTitle.trim(), kind: "manual" }),
      });
      setNewTitle("");
      setShowNewForm(false);
      void fetchData();
    },
    { toast: toastFn, successMessage: "Reminder created" }
  );

  const handleComplete = async (id: string) => {
    if (actioningId) return;
    const prev = reminders.find((r) => r.id === id);
    if (!prev) return;
    setActioningId(id);
    setReminders((list) =>
      list.map((r) =>
        r.id === id ? { ...r, status: "done" } : r
      )
    );
    try {
      const res = await fetch(`/api/reminders/${id}/complete`, { method: "POST" });
      if (res.ok) void fetchData();
      else {
        setReminders((list) =>
          list.map((r) => (r.id === id ? prev : r))
        );
        const d = await res.json().catch(() => ({}));
        toast.error(d?.error ?? "Failed to complete");
      }
    } catch {
      setReminders((list) =>
        list.map((r) => (r.id === id ? prev : r))
      );
      toast.error("Failed to complete");
    } finally {
      setActioningId(null);
    }
  };

  const handleSnooze = async (id: string, preset: string) => {
    if (actioningId) return;
    const prev = reminders.find((r) => r.id === id);
    if (!prev) return;
    setActioningId(id);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const snoozedUntil = tomorrow.toISOString();
    setReminders((list) =>
      list.map((r) =>
        r.id === id ? { ...r, status: "snoozed", snoozedUntil } : r
      )
    );
    try {
      const res = await fetch(`/api/reminders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snoozePreset: preset }),
      });
      if (res.ok) void fetchData();
      else {
        setReminders((list) =>
          list.map((r) => (r.id === id ? prev : r))
        );
        const d = await res.json().catch(() => ({}));
        toast.error(d?.error ?? "Failed to snooze");
      }
    } catch {
      setReminders((list) =>
        list.map((r) => (r.id === id ? prev : r))
      );
      toast.error("Failed to snooze");
    } finally {
      setActioningId(null);
    }
  };

  const handleDismiss = async (id: string) => {
    if (actioningId) return;
    const ok = await confirm({ title: "Dismiss this reminder?", body: "This reminder will be permanently dismissed.", variant: "destructive" });
    if (!ok) return;
    const prev = reminders.find((r) => r.id === id);
    if (!prev) return;
    setActioningId(id);
    setReminders((list) =>
      list.map((r) =>
        r.id === id ? { ...r, status: "dismissed" } : r
      )
    );
    try {
      const res = await fetch(`/api/reminders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "dismissed" }),
      });
      if (res.ok) void fetchData();
      else {
        setReminders((list) =>
          list.map((r) => (r.id === id ? prev : r))
        );
        const d = await res.json().catch(() => ({}));
        toast.error(d?.error ?? "Failed to dismiss");
      }
    } catch {
      setReminders((list) =>
        list.map((r) => (r.id === id ? prev : r))
      );
      toast.error("Failed to dismiss");
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reminders</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Central queue for follow-ups, deliveries, proof gaps, and snapshots.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void runRules.execute()} disabled={runRules.pending}>
            <Play className="w-4 h-4 mr-1" />
            {runRules.pending ? "Running…" : "Run Rules"}
          </Button>
          <Button size="sm" onClick={() => setShowNewForm(true)} disabled={showNewForm}>
            <Plus className="w-4 h-4 mr-1" />
            New Reminder
          </Button>
        </div>
      </div>

      {showNewForm && (
        <div className="flex gap-2 items-center rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
          <input
            type="text"
            placeholder="Reminder title…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && newTitle.trim()) void createReminder.execute(); }}
            className="flex-1 px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-sm"
            autoFocus
          />
          <Button size="sm" onClick={() => void createReminder.execute()} disabled={!newTitle.trim() || createReminder.pending}>
            {createReminder.pending ? "Creating…" : "Create"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setShowNewForm(false); setNewTitle(""); }}>
            Cancel
          </Button>
        </div>
      )}

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
            <p className="text-xs text-neutral-500">Open</p>
            <p className="text-xl font-semibold">{summary.open}</p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
            <p className="text-xs text-neutral-500">Overdue</p>
            <p className="text-xl font-semibold text-red-400">{summary.overdue}</p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
            <p className="text-xs text-neutral-500">Today</p>
            <p className="text-xl font-semibold text-amber-400">{summary.today}</p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
            <p className="text-xs text-neutral-500">High Priority</p>
            <p className="text-xl font-semibold">{summary.highPriority}</p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
            <p className="text-xs text-neutral-500">Done This Week</p>
            <p className="text-xl font-semibold text-emerald-400">{summary.doneThisWeek}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={bucket}
          onChange={(e) => url.setFilter("bucket", e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm"
        >
          <option value="">All buckets</option>
          <option value="overdue">Overdue</option>
          <option value="today">Today</option>
          <option value="upcoming">Upcoming</option>
          <option value="snoozed">Snoozed</option>
          <option value="unscheduled">Unscheduled</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => url.setFilter("status", e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="snoozed">Snoozed</option>
          <option value="done">Done</option>
          <option value="dismissed">Dismissed</option>
        </select>
        <Button variant="ghost" size="sm" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Reminder list */}
      <AsyncState
        loading={loading}
        error={error}
        empty={!loading && !error && reminders.length === 0}
        emptyMessage="No reminders"
        onRetry={fetchData}
      >
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 overflow-hidden">
          {reminders.length > 0 ? (
          <div className="divide-y divide-neutral-800">
            {reminders.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center gap-3 p-4 hover:bg-neutral-800/30"
              >
                <Badge className={priorityColor(r.priority)}>{r.priority}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{r.title}</p>
                  {r.description && (
                    <p className="text-xs text-neutral-500 truncate">{r.description}</p>
                  )}
                  <div className="flex gap-3 mt-1 text-xs text-neutral-400">
                    <span>{r.kind}</span>
                    <span>Due: {formatDateSafe(r.snoozedUntil ?? r.dueAt, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    <span>{r.status}</span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {r.actionUrl && (
                    <Link href={r.actionUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </Link>
                  )}
                  {(r.status === "open" || r.status === "snoozed") && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleComplete(r.id)}
                        disabled={actioningId === r.id}
                        className="text-emerald-400"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSnooze(r.id, "tomorrow")}
                        disabled={actioningId === r.id}
                        className="text-amber-400"
                      >
                        <Clock className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDismiss(r.id)}
                        disabled={actioningId === r.id}
                        className="text-neutral-400"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          ) : (
            <div className="py-12 text-center text-neutral-500">No reminders</div>
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
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
