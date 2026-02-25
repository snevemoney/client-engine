"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { AsyncState } from "@/components/ui/AsyncState";
import { FollowupBucketTable, type FollowUpItem } from "@/components/followup/FollowupBucketTable";
import { FollowupCompleteModal } from "@/components/followup/FollowupCompleteModal";
import { FollowupSnoozeModal } from "@/components/followup/FollowupSnoozeModal";
import { FollowupLogModal } from "@/components/followup/FollowupLogModal";
import { FollowupDueBadge, type DueBucket } from "@/components/followup/FollowupDueBadge";

type ApiResponse = {
  overdue: FollowUpItem[];
  today: FollowUpItem[];
  upcoming: FollowUpItem[];
  totals: { overdue: number; today: number; upcoming: number; all: number };
};

const BUCKET_OPTIONS = ["all", "overdue", "today", "upcoming"] as const;
const SOURCE_OPTIONS = ["all", "upwork", "linkedin", "referral", "inbound", "rss", "other"];
const STATUS_OPTIONS = ["all", "new", "qualified", "proposal_drafted", "sent"];

export default function FollowupsPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [bucketFilter, setBucketFilter] = useState<(typeof BUCKET_OPTIONS)[number]>("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [completeItem, setCompleteItem] = useState<FollowUpItem | null>(null);
  const [snoozeItem, setSnoozeItem] = useState<FollowUpItem | null>(null);
  const [logItem, setLogItem] = useState<FollowUpItem | null>(null);
  const [logKind, setLogKind] = useState<"call" | "email">("call");
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);

  const fetchData = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const runId = ++runIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (bucketFilter !== "all") params.set("bucket", bucketFilter);
      if (sourceFilter !== "all") params.set("source", sourceFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/followups?${params}`, {
        credentials: "include",
        signal: controller.signal,
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (controller.signal.aborted || runId !== runIdRef.current) return;
      if (!res.ok) {
        setError(typeof json?.error === "string" ? json.error : `Failed to load (${res.status})`);
        setData(null);
        return;
      }
      setData(json);
    } catch (e) {
      if (controller.signal.aborted || runId !== runIdRef.current) return;
      if (e instanceof Error && (e.name === "AbortError" || e.message?.includes("aborted"))) return;
      setError(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      if (runId === runIdRef.current) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }, [debouncedSearch, bucketFilter, sourceFilter, statusFilter]);

  useEffect(() => {
    void fetchData();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchData]);

  const runAction = async (
    itemId: string,
    fn: () => Promise<Response>
  ) => {
    setActionLoading(itemId);
    try {
      const res = await fn();
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        alert(typeof json?.error === "string" ? json.error : `Action failed (${res.status})`);
        return;
      }
      void fetchData();
    } finally {
      setActionLoading(null);
    }
  };

  const handleComplete = (item: FollowUpItem) => setCompleteItem(item);
  const handleCompleteSubmit = async (payload: {
    note?: string;
    nextAction?: string;
    nextActionDueAt?: string;
  }) => {
    if (!completeItem) return;
    await runAction(completeItem.id, () =>
      fetch(`/api/intake-leads/${completeItem.id}/followup-complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
    );
    setCompleteItem(null);
  };

  const handleSnooze = (item: FollowUpItem) => setSnoozeItem(item);
  const handleSnoozeSubmit = async (payload: {
    snoozeType: "2d" | "5d" | "next_monday" | "custom";
    nextActionDueAt?: string;
    reason?: string;
  }) => {
    if (!snoozeItem) return;
    await runAction(snoozeItem.id, () =>
      fetch(`/api/intake-leads/${snoozeItem.id}/followup-snooze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
    );
    setSnoozeItem(null);
  };

  const handleLogCall = (item: FollowUpItem) => {
    setLogItem(item);
    setLogKind("call");
  };
  const handleLogEmail = (item: FollowUpItem) => {
    setLogItem(item);
    setLogKind("email");
  };
  const handleLogSubmit = async (payload: {
    note?: string;
    outcome: string;
    nextAction?: string;
    nextActionDueAt?: string;
  }) => {
    if (!logItem) return;
    const route =
      logKind === "call"
        ? `/api/intake-leads/${logItem.id}/followup-log-call`
        : `/api/intake-leads/${logItem.id}/followup-log-email`;
    await runAction(logItem.id, () =>
      fetch(route, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
    );
    setLogItem(null);
  };

  const totals = data?.totals ?? { overdue: 0, today: 0, upcoming: 0, all: 0 };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Follow-ups</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Overdue, due today, and upcoming. Complete, snooze, or log calls and emails.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-3">
          <p className="text-xs text-neutral-500 uppercase">Overdue</p>
          <p className="text-xl font-semibold text-red-400">{totals.overdue}</p>
        </div>
        <div className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-3">
          <p className="text-xs text-neutral-500 uppercase">Due today</p>
          <p className="text-xl font-semibold text-amber-400">{totals.today}</p>
        </div>
        <div className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-3">
          <p className="text-xs text-neutral-500 uppercase">Upcoming (7d)</p>
          <p className="text-xl font-semibold text-neutral-200">{totals.upcoming}</p>
        </div>
        <div className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-3">
          <p className="text-xs text-neutral-500 uppercase">All</p>
          <p className="text-xl font-semibold text-neutral-200">{totals.all}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
          <Input
            placeholder="Search title, company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-neutral-900 border-neutral-700"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={bucketFilter}
            onChange={(e) => setBucketFilter(e.target.value as (typeof BUCKET_OPTIONS)[number])}
            className="rounded-md border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-neutral-100"
          >
            {BUCKET_OPTIONS.map((b) => (
              <option key={b} value={b}>
                {b === "all" ? "All buckets" : b}
              </option>
            ))}
          </select>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="rounded-md border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-neutral-100"
          >
            {SOURCE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "Source: All" : s}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-neutral-100"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "Status: All" : s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <AsyncState
        loading={loading}
        error={error}
        empty={!loading && !error && !data}
        emptyMessage="No follow-ups match these filters."
        onRetry={fetchData}
      >
        {data ? (
        <div className="space-y-6">
          {bucketFilter === "all" || bucketFilter === "overdue" ? (
            <section className="rounded-lg border border-neutral-700 bg-neutral-900/50 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-neutral-700 bg-neutral-800/50">
                <FollowupDueBadge bucket="overdue" />
                <span className="text-sm text-neutral-400">({data.overdue.length})</span>
              </div>
              <FollowupBucketTable
                items={data.overdue}
                bucket="overdue"
                onComplete={handleComplete}
                onSnooze={handleSnooze}
                onLogCall={handleLogCall}
                onLogEmail={handleLogEmail}
                actionLoading={actionLoading}
              />
            </section>
          ) : null}

          {bucketFilter === "all" || bucketFilter === "today" ? (
            <section className="rounded-lg border border-neutral-700 bg-neutral-900/50 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-neutral-700 bg-neutral-800/50">
                <FollowupDueBadge bucket="today" />
                <span className="text-sm text-neutral-400">({data.today.length})</span>
              </div>
              <FollowupBucketTable
                items={data.today}
                bucket="today"
                onComplete={handleComplete}
                onSnooze={handleSnooze}
                onLogCall={handleLogCall}
                onLogEmail={handleLogEmail}
                actionLoading={actionLoading}
              />
            </section>
          ) : null}

          {bucketFilter === "all" || bucketFilter === "upcoming" ? (
            <section className="rounded-lg border border-neutral-700 bg-neutral-900/50 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-neutral-700 bg-neutral-800/50">
                <FollowupDueBadge bucket="upcoming" />
                <span className="text-sm text-neutral-400">({data.upcoming.length})</span>
              </div>
              <FollowupBucketTable
                items={data.upcoming}
                bucket="upcoming"
                onComplete={handleComplete}
                onSnooze={handleSnooze}
                onLogCall={handleLogCall}
                onLogEmail={handleLogEmail}
                actionLoading={actionLoading}
              />
            </section>
          ) : null}
        </div>
        ) : null}
      </AsyncState>

      {completeItem && (
        <FollowupCompleteModal
          item={completeItem}
          onClose={() => setCompleteItem(null)}
          onSubmit={handleCompleteSubmit}
          loading={actionLoading === completeItem.id}
        />
      )}

      {snoozeItem && (
        <FollowupSnoozeModal
          item={snoozeItem}
          onClose={() => setSnoozeItem(null)}
          onSubmit={handleSnoozeSubmit}
          loading={actionLoading === snoozeItem.id}
        />
      )}

      {logItem && (
        <FollowupLogModal
          item={logItem}
          kind={logKind}
          onClose={() => setLogItem(null)}
          onSubmit={handleLogSubmit}
          loading={actionLoading === logItem.id}
        />
      )}
    </div>
  );
}
