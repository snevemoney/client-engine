"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Search, ArrowRight, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { AsyncState } from "@/components/ui/AsyncState";
import { formatDateSafe } from "@/lib/ui/date-safe";

type HandoffItem = {
  id: string;
  title: string;
  clientName: string | null;
  company: string | null;
  status: string;
  completedAt: string | null;
  handoffStartedAt: string | null;
  handoffCompletedAt: string | null;
  handoffOwner: string | null;
  clientConfirmedAt: string | null;
  handoffState: string;
};

type Summary = {
  completedNoHandoff: number;
  handoffInProgress: number;
  handoffCompleted: number;
  handoffMissingClientConfirm: number;
};

function daysAgo(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function DaysWaitingBadge({ days }: { days: number | null }) {
  if (days === null) return <span className="text-neutral-600">—</span>;
  if (days <= 3) return <span className="text-neutral-400">{days}d</span>;
  if (days <= 7)
    return (
      <span className="text-amber-400 flex items-center gap-1">
        <Clock className="w-3 h-3" />
        {days}d
      </span>
    );
  return (
    <span className="text-red-400 flex items-center gap-1">
      <AlertTriangle className="w-3 h-3" />
      {days}d
    </span>
  );
}

function HandoffStateBadge({ state }: { state: string }) {
  const config: Record<string, { color: string; label: string }> = {
    completed_no_handoff: { color: "text-amber-400 border-amber-400/30", label: "Needs handoff" },
    handoff_in_progress: { color: "text-blue-400 border-blue-400/30", label: "In progress" },
    handoff_completed: { color: "text-emerald-400 border-emerald-400/30", label: "Completed" },
    handoff_missing_client_confirm: { color: "text-orange-400 border-orange-400/30", label: "Awaiting confirm" },
  };
  const c = config[state] ?? { color: "", label: state.replace(/_/g, " ") };
  return <Badge variant="outline" className={c.color}>{c.label}</Badge>;
}

export default function HandoffsPage() {
  const [items, setItems] = useState<HandoffItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [statusFilter, setStatusFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("");
  const debouncedOwner = useDebouncedValue(ownerFilter, 300);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
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
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (debouncedOwner.trim()) params.set("owner", debouncedOwner.trim());
      const [res, sumRes] = await Promise.all([
        fetch(`/api/delivery-projects/handoff-queue?${params}`, { credentials: "include", signal: controller.signal, cache: "no-store" }),
        fetch("/api/delivery-projects/handoff-summary", { credentials: "include", signal: controller.signal, cache: "no-store" }),
      ]);
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error ?? `Failed to load handoffs (${res.status})`);
      }
      const json = await res.json().catch(() => null);
      const sumJson = sumRes.ok ? await sumRes.json().catch(() => null) : null;
      if (controller.signal.aborted || runId !== runIdRef.current) return;
      setItems(Array.isArray(json?.items) ? json.items : (Array.isArray(json) ? json : []));
      setSummary(sumJson && typeof sumJson === "object" ? sumJson : null);
    } catch (e) {
      if (controller.signal.aborted || runId !== runIdRef.current) return;
      if (e instanceof Error && (e.name === "AbortError" || e.message?.includes("aborted"))) return;
      setError(e instanceof Error ? e.message : "Failed to load");
      setItems([]);
      setSummary(null);
    } finally {
      if (runId === runIdRef.current) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }, [debouncedSearch, statusFilter, debouncedOwner]);

  useEffect(() => {
    void fetchData();
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [fetchData]);

  // Read URL params for initial filter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("status");
    if (s && s !== "all") setStatusFilter(s);
  }, []);

  const runAction = async (id: string, fn: () => Promise<Response>) => {
    setActionLoading(id);
    try {
      const res = await fn();
      if (res.ok) {
        toast.success("Done");
        void fetchData();
      } else {
        const d = await res.json().catch(() => null);
        toast.error(d?.error ?? "Action failed");
      }
    } catch {
      toast.error("Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const startHandoff = (id: string) =>
    runAction(id, () =>
      fetch(`/api/delivery-projects/${id}/handoff/start`, {
        method: "POST",
        credentials: "include",
      })
    );

  const completeHandoff = (id: string) =>
    runAction(id, () =>
      fetch(`/api/delivery-projects/${id}/handoff/complete`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      })
    );

  const confirmClient = (id: string) =>
    runAction(id, () =>
      fetch(`/api/delivery-projects/${id}/client-confirm`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );

  const s = summary ?? {
    completedNoHandoff: 0,
    handoffInProgress: 0,
    handoffCompleted: 0,
    handoffMissingClientConfirm: 0,
  };

  const total = s.completedNoHandoff + s.handoffInProgress + s.handoffCompleted + s.handoffMissingClientConfirm;
  const needsAttention = s.completedNoHandoff + s.handoffMissingClientConfirm;

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Handoffs</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Post-delivery handoff queue — start handoffs, complete them, and get client confirmation.
          </p>
        </div>
        {needsAttention > 0 && (
          <div className="text-right">
            <p className="text-xs text-neutral-500">Needs attention</p>
            <p className="text-lg font-semibold text-amber-400">{needsAttention}</p>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "completed_no_handoff" ? "all" : "completed_no_handoff")}
          className={`rounded-lg border p-4 text-left transition-colors ${
            statusFilter === "completed_no_handoff"
              ? "border-amber-600/40 bg-amber-600/10"
              : "border-neutral-800 bg-neutral-900/50 hover:bg-neutral-800/50"
          }`}
        >
          <p className="text-xs text-neutral-500 uppercase">Needs handoff</p>
          <p className="text-xl font-semibold text-amber-400">{s.completedNoHandoff}</p>
          {s.completedNoHandoff > 0 && (
            <p className="text-[10px] text-neutral-600 mt-1">Click to filter</p>
          )}
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "handoff_in_progress" ? "all" : "handoff_in_progress")}
          className={`rounded-lg border p-4 text-left transition-colors ${
            statusFilter === "handoff_in_progress"
              ? "border-blue-600/40 bg-blue-600/10"
              : "border-neutral-800 bg-neutral-900/50 hover:bg-neutral-800/50"
          }`}
        >
          <p className="text-xs text-neutral-500 uppercase">In progress</p>
          <p className="text-xl font-semibold text-blue-400">{s.handoffInProgress}</p>
          {s.handoffInProgress > 0 && (
            <p className="text-[10px] text-neutral-600 mt-1">Click to filter</p>
          )}
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "handoff_completed" ? "all" : "handoff_completed")}
          className={`rounded-lg border p-4 text-left transition-colors ${
            statusFilter === "handoff_completed"
              ? "border-emerald-600/40 bg-emerald-600/10"
              : "border-neutral-800 bg-neutral-900/50 hover:bg-neutral-800/50"
          }`}
        >
          <p className="text-xs text-neutral-500 uppercase">Completed</p>
          <p className="text-xl font-semibold text-emerald-400">{s.handoffCompleted}</p>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "handoff_missing_client_confirm" ? "all" : "handoff_missing_client_confirm")}
          className={`rounded-lg border p-4 text-left transition-colors ${
            statusFilter === "handoff_missing_client_confirm"
              ? "border-orange-600/40 bg-orange-600/10"
              : "border-neutral-800 bg-neutral-900/50 hover:bg-neutral-800/50"
          }`}
        >
          <p className="text-xs text-neutral-500 uppercase">Awaiting confirm</p>
          <p className="text-xl font-semibold text-orange-400">{s.handoffMissingClientConfirm}</p>
          {s.handoffMissingClientConfirm > 0 && (
            <p className="text-[10px] text-neutral-600 mt-1">Click to filter</p>
          )}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-md bg-neutral-900 border border-neutral-800 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm"
        >
          <option value="all">All states ({total})</option>
          <option value="completed_no_handoff">Needs handoff ({s.completedNoHandoff})</option>
          <option value="handoff_in_progress">In progress ({s.handoffInProgress})</option>
          <option value="handoff_completed">Completed ({s.handoffCompleted})</option>
          <option value="handoff_missing_client_confirm">Awaiting confirm ({s.handoffMissingClientConfirm})</option>
        </select>
        <input
          type="text"
          placeholder="Filter by owner"
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
          className="rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm w-36"
        />
      </div>

      <AsyncState
        loading={loading}
        error={error}
        empty={!loading && !error && items.length === 0}
        emptyMessage={
          statusFilter !== "all"
            ? `No projects with status "${statusFilter.replace(/_/g, " ")}".`
            : "No completed projects yet. Projects appear here after delivery is marked complete."
        }
        onRetry={fetchData}
      >
        <div className="rounded-lg border border-neutral-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/50">
                <th className="text-left p-3 font-medium">Project</th>
                <th className="text-left p-3 font-medium">Completed</th>
                <th className="text-left p-3 font-medium">Waiting</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Owner</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const isLoading = actionLoading === p.id;
                const waiting = daysAgo(
                  p.handoffState === "completed_no_handoff"
                    ? p.completedAt
                    : p.handoffState === "handoff_in_progress"
                      ? p.handoffStartedAt
                      : p.handoffState === "handoff_missing_client_confirm"
                        ? p.handoffCompletedAt
                        : null
                );

                return (
                  <tr key={p.id} className="border-b border-neutral-800/50 hover:bg-neutral-900/30">
                    <td className="p-3">
                      <Link href={`/dashboard/delivery/${p.id}`} className="font-medium text-neutral-100 hover:underline">
                        {p.title ?? "—"}
                      </Link>
                      <p className="text-xs text-neutral-500">{p.clientName ?? p.company ?? "—"}</p>
                    </td>
                    <td className="p-3 text-neutral-400 text-xs">
                      {formatDateSafe(p.completedAt, { month: "short", day: "numeric" })}
                    </td>
                    <td className="p-3 text-xs">
                      <DaysWaitingBadge days={waiting} />
                    </td>
                    <td className="p-3">
                      <HandoffStateBadge state={p.handoffState} />
                    </td>
                    <td className="p-3 text-neutral-400 text-xs">{p.handoffOwner ?? "—"}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {p.handoffState === "completed_no_handoff" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isLoading}
                            onClick={() => startHandoff(p.id)}
                            className="text-amber-400 border-amber-400/30 hover:bg-amber-400/10"
                          >
                            {isLoading ? "..." : "Start handoff"}
                            <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        )}
                        {p.handoffState === "handoff_in_progress" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isLoading}
                            onClick={() => completeHandoff(p.id)}
                            className="text-blue-400 border-blue-400/30 hover:bg-blue-400/10"
                          >
                            {isLoading ? "..." : "Complete"}
                            <CheckCircle className="w-3 h-3 ml-1" />
                          </Button>
                        )}
                        {p.handoffState === "handoff_missing_client_confirm" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isLoading}
                            onClick={() => confirmClient(p.id)}
                            className="text-orange-400 border-orange-400/30 hover:bg-orange-400/10"
                          >
                            {isLoading ? "..." : "Confirm"}
                            <CheckCircle className="w-3 h-3 ml-1" />
                          </Button>
                        )}
                        {p.handoffState === "handoff_completed" && (
                          <span className="text-emerald-400 text-xs flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Done
                          </span>
                        )}
                        <Link href={`/dashboard/delivery/${p.id}`}>
                          <Button variant="ghost" size="sm" className="text-neutral-500">
                            View
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </AsyncState>
    </div>
  );
}
