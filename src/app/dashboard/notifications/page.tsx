"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Play, RotateCw, ExternalLink } from "lucide-react";
import { AsyncState } from "@/components/ui/AsyncState";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { formatDateSafe } from "@/lib/ui/date-safe";
import { normalizePagination } from "@/lib/ui/pagination-safe";
import { useUrlQueryState } from "@/hooks/useUrlQueryState";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type Event = {
  id: string;
  eventKey: string;
  title: string;
  message: string;
  severity: string;
  sourceType: string | null;
  sourceId: string | null;
  actionUrl: string | null;
  status: string;
  occurredAt: string;
  sentAt: string | null;
  failedAt: string | null;
  createdByRule: string | null;
  deliverySummary: { sent: number; failed: number; queued: number };
};

function severityColor(s: string): string {
  if (s === "critical") return "bg-red-500/20 text-red-400";
  if (s === "warning") return "bg-amber-500/20 text-amber-400";
  return "bg-neutral-500/20 text-neutral-300";
}

function statusColor(s: string): string {
  if (s === "sent") return "text-emerald-400";
  if (s === "failed") return "text-red-400";
  if (s === "queued" || s === "pending") return "text-amber-400";
  return "text-neutral-400";
}

export default function NotificationsPage() {
  const url = useUrlQueryState();
  const [items, setItems] = useState<Event[]>([]);
  const [pagination, setPagination] = useState(() => normalizePagination(null, 0));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [runEscLoading, setRunEscLoading] = useState(false);
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const { confirm: confirmAction, dialogProps: actionDialogProps } = useConfirmDialog();
  const status = url.getString("status", "");
  const severity = url.getString("severity", "");
  const sourceType = url.getString("sourceType", "");
  const search = url.getString("search", "");
  const page = url.getPage();
  const pageSize = url.getPageSize();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (severity) params.set("severity", severity);
    if (sourceType) params.set("sourceType", sourceType);
    if (search) params.set("search", search);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    try {
      const res = await fetch(`/api/notifications?${params}`, { credentials: "include", cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to load");
      setItems(data?.items ?? []);
      setPagination(normalizePagination(data?.pagination, data?.items?.length ?? 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setItems([]);
      setPagination(normalizePagination(null, 0));
    } finally {
      setLoading(false);
    }
  }, [status, severity, sourceType, search, page, pageSize]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleRunEscalations = async () => {
    const ok = await confirmAction({ title: "Run escalations", body: "This will run the escalation check and create notification events. Continue?", confirmLabel: "Run" });
    if (!ok) return;
    setRunEscLoading(true);
    try {
      const res = await fetch("/api/notifications/run-escalations", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        if (data.created > 0 || data.queued > 0) void fetchData();
      } else toast.error(data?.error ?? "Failed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Escalation run failed");
    } finally {
      setRunEscLoading(false);
    }
  };

  const handleDispatch = async () => {
    const ok = await confirmAction({ title: "Dispatch pending", body: "This will dispatch all pending notifications. Continue?", confirmLabel: "Dispatch" });
    if (!ok) return;
    setDispatchLoading(true);
    try {
      const res = await fetch("/api/notifications/dispatch", { method: "POST" });
      const data = await res.json();
      if (res.ok) void fetchData();
      else toast.error(data?.error ?? "Failed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Dispatch failed");
    } finally {
      setDispatchLoading(false);
    }
  };

  const handleRetry = async (id: string) => {
    if (actioningId) return;
    setActioningId(id);
    try {
      const res = await fetch(`/api/notifications/${id}/retry-failed`, { method: "POST" });
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

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notification Events</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Events from escalations, jobs, reminders. Run escalations or dispatch manually.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/inbox">
            <Button variant="outline" size="sm">Inbox</Button>
          </Link>
          <Link href="/dashboard/notification-channels">
            <Button variant="outline" size="sm">Channels</Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunEscalations}
            disabled={runEscLoading}
          >
            <Play className="w-4 h-4 mr-1" />
            {runEscLoading ? "Running…" : "Run Escalations"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDispatch}
            disabled={dispatchLoading}
          >
            <Play className="w-4 h-4 mr-1" />
            {dispatchLoading ? "Dispatching…" : "Dispatch Pending"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void fetchData()}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={status}
          onChange={(e) => url.setFilter("status", e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="queued">Queued</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="suppressed">Suppressed</option>
        </select>
        <select
          value={severity}
          onChange={(e) => url.setFilter("severity", e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm"
        >
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
        <select
          value={sourceType}
          onChange={(e) => url.setFilter("sourceType", e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm"
        >
          <option value="">All sources</option>
          <option value="job">Job</option>
          <option value="reminder">Reminder</option>
          <option value="review">Review</option>
          <option value="snapshot">Snapshot</option>
          <option value="delivery">Delivery</option>
        </select>
        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={(e) => url.setSearch(e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm w-40"
        />
      </div>

      <AsyncState
        loading={loading}
        error={error}
        empty={!loading && !error && items.length === 0}
        emptyMessage="No notification events"
        onRetry={fetchData}
      >
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 overflow-hidden">
          {items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-900/80">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-neutral-300">Time</th>
                    <th className="text-left px-4 py-3 font-medium text-neutral-300">Severity</th>
                    <th className="text-left px-4 py-3 font-medium text-neutral-300">Title</th>
                    <th className="text-left px-4 py-3 font-medium text-neutral-300">Source</th>
                    <th className="text-left px-4 py-3 font-medium text-neutral-300">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-neutral-300">Delivery</th>
                    <th className="text-left px-4 py-3 font-medium text-neutral-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((e) => (
                    <tr key={e.id} className="border-t border-neutral-800 hover:bg-neutral-800/30">
                      <td className="px-4 py-3 text-neutral-400 whitespace-nowrap">
                        {formatDateSafe(e.occurredAt, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={severityColor(e.severity)}>{e.severity}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium truncate max-w-[200px]">{e.title}</p>
                        <p className="text-xs text-neutral-500 truncate max-w-[200px]">{e.message}</p>
                      </td>
                      <td className="px-4 py-3 text-neutral-400">
                        {e.sourceType ?? "—"} {e.sourceId ? `#${e.sourceId.slice(-6)}` : ""}
                      </td>
                      <td className={`px-4 py-3 ${statusColor(e.status)}`}>{e.status}</td>
                      <td className="px-4 py-3 text-neutral-400">
                        {e.deliverySummary.sent} sent / {e.deliverySummary.failed} failed / {e.deliverySummary.queued} queued
                      </td>
                      <td className="px-4 py-3">
                        {e.actionUrl && (
                          <Link href={e.actionUrl}>
                            <Button variant="ghost" size="sm">
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </Link>
                        )}
                        {e.status === "failed" && e.deliverySummary.failed > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRetry(e.id)}
                            disabled={actioningId === e.id}
                            className="text-amber-400"
                          >
                            <RotateCw className="w-4 h-4 mr-1" />
                            Retry
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-neutral-500">No notification events</div>
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
      <ConfirmDialog {...actionDialogProps} />
    </div>
  );
}
