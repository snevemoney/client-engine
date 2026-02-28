"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Search } from "lucide-react";
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

function HandoffStateBadge({ state }: { state: string }) {
  const map: Record<string, string> = {
    completed_no_handoff: "text-amber-400",
    handoff_in_progress: "text-blue-400",
    handoff_completed: "text-emerald-400",
    handoff_missing_client_confirm: "text-amber-400",
  };
  const label = state.replace(/_/g, " ");
  return <Badge variant="outline" className={`capitalize ${map[state] ?? ""}`}>{label}</Badge>;
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

  const run = async (id: string, action: string, fn: () => Promise<Response>) => {
    setActionLoading(id);
    try {
      const res = await fn();
      if (res.ok) void fetchData();
      else {
        const d = await res.json().catch(() => null);
        toast.error(d?.error ?? "Action failed");
      }
    } catch {
      toast.error("Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const s = summary ?? {
    completedNoHandoff: 0,
    handoffInProgress: 0,
    handoffCompleted: 0,
    handoffMissingClientConfirm: 0,
  };

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Handoffs</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Post-delivery handoff queue. Complete handoffs and get client confirmation.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link href="/dashboard/handoffs?status=completed_no_handoff">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 hover:bg-neutral-800/50 cursor-pointer">
            <p className="text-xs text-neutral-500 uppercase">Completed, no handoff</p>
            <p className="text-xl font-semibold text-amber-400">{s.completedNoHandoff}</p>
          </div>
        </Link>
        <Link href="/dashboard/handoffs?status=handoff_in_progress">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 hover:bg-neutral-800/50 cursor-pointer">
            <p className="text-xs text-neutral-500 uppercase">Handoff in progress</p>
            <p className="text-xl font-semibold text-blue-400">{s.handoffInProgress}</p>
          </div>
        </Link>
        <Link href="/dashboard/handoffs?status=handoff_completed">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 hover:bg-neutral-800/50 cursor-pointer">
            <p className="text-xs text-neutral-500 uppercase">Handoff completed</p>
            <p className="text-xl font-semibold text-emerald-400">{s.handoffCompleted}</p>
          </div>
        </Link>
        <Link href="/dashboard/handoffs?status=handoff_missing_client_confirm">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 hover:bg-neutral-800/50 cursor-pointer">
            <p className="text-xs text-neutral-500 uppercase">Missing client confirm</p>
            <p className="text-xl font-semibold text-amber-400">{s.handoffMissingClientConfirm}</p>
          </div>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Search..."
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
          <option value="all">All states</option>
          <option value="completed_no_handoff">Completed, no handoff</option>
          <option value="handoff_in_progress">Handoff in progress</option>
          <option value="handoff_completed">Handoff completed</option>
          <option value="handoff_missing_client_confirm">Missing client confirm</option>
        </select>
        <input
          type="text"
          placeholder="Owner"
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
          className="rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm w-32"
        />
      </div>

      <AsyncState
        loading={loading}
        error={error}
        empty={!loading && !error && items.length === 0}
        emptyMessage="No projects in handoff queue."
        onRetry={fetchData}
      >
        <div className="rounded-lg border border-neutral-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/50">
                <th className="text-left p-3 font-medium">Project</th>
                <th className="text-left p-3 font-medium">Delivery</th>
                <th className="text-left p-3 font-medium">Handoff</th>
                <th className="text-left p-3 font-medium">Client confirmed</th>
                <th className="text-left p-3 font-medium">Owner</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-b border-neutral-800/50 hover:bg-neutral-900/30">
                  <td className="p-3">
                    <Link href={`/dashboard/delivery/${p.id}`} className="font-medium text-neutral-100 hover:underline">
                      {p.title ?? "—"}
                    </Link>
                    <p className="text-xs text-neutral-500">{p.clientName ?? p.company ?? "—"}</p>
                  </td>
                  <td className="p-3 text-neutral-400">{formatDateSafe(p.completedAt, { month: "short", day: "numeric" })}</td>
                  <td className="p-3"><HandoffStateBadge state={p.handoffState} /></td>
                  <td className="p-3 text-neutral-400">
                    {p.clientConfirmedAt ? "✓" : "—"}
                  </td>
                  <td className="p-3 text-neutral-400">{p.handoffOwner ?? "—"}</td>
                  <td className="p-3 text-right">
                    <Link href={`/dashboard/delivery/${p.id}`}>
                      <Button variant="ghost" size="sm" disabled={!!actionLoading}>
                        Open project
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AsyncState>
    </div>
  );
}
