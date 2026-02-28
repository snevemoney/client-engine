"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Check, CheckCheck, ExternalLink } from "lucide-react";
import { AsyncState } from "@/components/ui/AsyncState";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { formatDateSafe } from "@/lib/ui/date-safe";
import { normalizePagination } from "@/lib/ui/pagination-safe";
import { useUrlQueryState } from "@/hooks/useUrlQueryState";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type InAppItem = {
  id: string;
  notificationEventId: string | null;
  title: string;
  message: string;
  severity: string;
  actionUrl: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

type Summary = {
  pending: number;
  sentToday: number;
  failedToday: number;
  criticalOpen: number;
  unreadInApp: number;
  deadLetterAlerts: number;
  staleJobAlerts: number;
};

function severityColor(s: string): string {
  if (s === "critical") return "bg-red-500/20 text-red-400";
  if (s === "warning") return "bg-amber-500/20 text-amber-400";
  return "bg-neutral-500/20 text-neutral-300";
}

export default function InboxPage() {
  const { confirm, dialogProps } = useConfirmDialog();
  const url = useUrlQueryState();
  const [items, setItems] = useState<InAppItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pagination, setPagination] = useState(() => normalizePagination(null, 0));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const unreadOnly = url.getString("unreadOnly", "") === "1";
  const severity = url.getString("severity", "");
  const page = url.getPage();
  const pageSize = url.getPageSize();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (unreadOnly) params.set("unreadOnly", "1");
    if (severity) params.set("severity", severity);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    try {
      const [data, sum] = await Promise.all([
        fetch(`/api/in-app-notifications?${params}`, { credentials: "include", cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
        fetch("/api/notifications/summary", { credentials: "include", cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      ]);
      setItems(data?.items ?? []);
      setPagination(normalizePagination(data?.pagination, data?.items?.length ?? 0));
      setSummary(sum ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setItems([]);
      setPagination(normalizePagination(null, 0));
    } finally {
      setLoading(false);
    }
  }, [unreadOnly, severity, page, pageSize]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleMarkRead = async (id: string) => {
    if (actioningId) return;
    setActioningId(id);
    setItems((list) => list.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    try {
      const res = await fetch(`/api/in-app-notifications/${id}/read`, { method: "POST" });
      if (res.ok) void fetchData();
      else {
        setItems((list) => list.map((n) => (n.id === id ? { ...n, isRead: false } : n)));
        const d = await res.json().catch(() => null);
        toast.error(d?.error ?? "Failed");
      }
    } catch {
      setItems((list) => list.map((n) => (n.id === id ? { ...n, isRead: false } : n)));
      toast.error("Failed to mark as read");
    } finally {
      setActioningId(null);
    }
  };

  const handleMarkAllRead = async () => {
    if (actioningId) return;
    const ok = await confirm({
      title: "Mark all as read?",
      body: "This will mark all notifications as read. This cannot be undone.",
      confirmLabel: "Mark all read",
    });
    if (!ok) return;
    setActioningId("all");
    try {
      const res = await fetch("/api/in-app-notifications/read-all", { method: "POST" });
      if (res.ok) void fetchData();
      else {
        const d = await res.json().catch(() => null);
        toast.error(d?.error ?? "Failed");
      }
    } catch {
      toast.error("Failed to mark all as read");
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notification Inbox</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Internal notifications from escalations, jobs, and reminders.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/notifications">
            <Button variant="outline" size="sm">Events</Button>
          </Link>
          <Link href="/dashboard/notification-channels">
            <Button variant="outline" size="sm">Channels</Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => void fetchData()}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
            <p className="text-xs text-neutral-500">Unread</p>
            <p className="text-xl font-semibold">{summary.unreadInApp}</p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
            <p className="text-xs text-neutral-500">Critical Open</p>
            <p className="text-xl font-semibold text-red-400">{summary.criticalOpen}</p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
            <p className="text-xs text-neutral-500">Sent Today</p>
            <p className="text-xl font-semibold text-emerald-400">{summary.sentToday}</p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
            <p className="text-xs text-neutral-500">Failed Today</p>
            <p className="text-xl font-semibold text-amber-400">{summary.failedToday}</p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
            <p className="text-xs text-neutral-500">Pending</p>
            <p className="text-xl font-semibold">{summary.pending}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <select
          value={unreadOnly ? "1" : ""}
          onChange={(e) => url.setFilter("unreadOnly", e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm"
        >
          <option value="">All</option>
          <option value="1">Unread only</option>
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
        {summary && summary.unreadInApp > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={!!actioningId}>
            <CheckCheck className="w-4 h-4 mr-1" />
            Mark all read
          </Button>
        )}
      </div>

      <AsyncState
        loading={loading}
        error={error}
        empty={!loading && !error && items.length === 0}
        emptyMessage="No notifications"
        onRetry={fetchData}
      >
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 overflow-hidden">
          {items.length > 0 ? (
            <div className="divide-y divide-neutral-800">
              {items.map((n) => (
                <div
                  key={n.id}
                  className={`flex flex-wrap items-center gap-3 p-4 hover:bg-neutral-800/30 ${!n.isRead ? "bg-neutral-800/20" : ""}`}
                >
                  <Badge className={severityColor(n.severity)}>{n.severity}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium truncate ${!n.isRead ? "text-neutral-100" : "text-neutral-400"}`}>{n.title}</p>
                    <p className="text-sm text-neutral-500 line-clamp-2">{n.message}</p>
                    <p className="text-xs text-neutral-500 mt-1">{formatDateSafe(n.createdAt, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {n.actionUrl && (
                      <Link href={n.actionUrl}>
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </Link>
                    )}
                    {!n.isRead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkRead(n.id)}
                        disabled={actioningId === n.id}
                        className="text-emerald-400"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-neutral-500">No notifications</div>
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
