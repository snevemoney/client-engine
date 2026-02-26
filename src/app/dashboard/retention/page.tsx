"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { AsyncState } from "@/components/ui/AsyncState";
import { formatDateSafe } from "@/lib/ui/date-safe";

type RetentionItem = {
  id: string;
  title: string;
  clientName: string | null;
  company: string | null;
  status: string;
  completedAt: string | null;
  handoffCompletedAt: string | null;
  testimonialRequestedAt: string | null;
  testimonialReceivedAt: string | null;
  testimonialStatus: string;
  reviewRequestedAt: string | null;
  reviewReceivedAt: string | null;
  referralRequestedAt: string | null;
  referralReceivedAt: string | null;
  referralStatus: string;
  retentionStatus: string;
  retentionBucket: string;
  retentionNextFollowUpAt: string | null;
  retentionLastContactedAt: string | null;
  retentionFollowUpCount: number;
  upsellOpportunity: string | null;
  upsellValueEstimate: number | null;
  isStale: boolean;
};

type Summary = {
  dueToday: number;
  overdue: number;
  upcoming: number;
  testimonialRequested: number;
  testimonialReceived: number;
  reviewRequested: number;
  reviewReceived: number;
  referralRequested: number;
  referralReceived: number;
  retainerOpen: number;
  upsellOpen: number;
  closedWon: number;
  closedLost: number;
  stalePostDelivery: number;
};

export default function RetentionPage() {
  const [items, setItems] = useState<RetentionItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [statusFilter, setStatusFilter] = useState("all");
  const [bucketFilter, setBucketFilter] = useState("all");
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
      if (bucketFilter !== "all") params.set("bucket", bucketFilter);
      const [res, sumRes] = await Promise.all([
        fetch(`/api/delivery-projects/retention-queue?${params}`, { credentials: "include", signal: controller.signal, cache: "no-store" }),
        fetch("/api/delivery-projects/retention-summary", { credentials: "include", signal: controller.signal, cache: "no-store" }),
      ]);
      if (controller.signal.aborted || runId !== runIdRef.current) return;
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error ?? `Retention queue failed (${res.status})`);
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
  }, [debouncedSearch, statusFilter, bucketFilter]);

  useEffect(() => {
    void fetchData();
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [fetchData]);

  const _run = async (id: string, fn: () => Promise<Response>) => {
    setActionLoading(id);
    try {
      const res = await fn();
      if (res.ok) void fetchData();
      else {
        const d = await res.json();
        alert(d?.error ?? "Action failed");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const s = summary ?? {
    dueToday: 0,
    overdue: 0,
    upcoming: 0,
    testimonialRequested: 0,
    testimonialReceived: 0,
    reviewRequested: 0,
    reviewReceived: 0,
    referralRequested: 0,
    referralReceived: 0,
    retainerOpen: 0,
    upsellOpen: 0,
    closedWon: 0,
    closedLost: 0,
    stalePostDelivery: 0,
  };

  return (
    <div className="space-y-6 min-w-0 max-w-full">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Retention</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Post-delivery retention follow-ups, testimonials, reviews, referrals, and upsells.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Link href="/dashboard/retention?bucket=overdue">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 sm:p-4 hover:bg-neutral-800/50 cursor-pointer">
            <p className="text-xs text-neutral-500 uppercase truncate">Overdue</p>
            <p className="text-xl font-semibold text-red-400">{s.overdue}</p>
          </div>
        </Link>
        <Link href="/dashboard/retention?bucket=today">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 sm:p-4 hover:bg-neutral-800/50 cursor-pointer">
            <p className="text-xs text-neutral-500 uppercase truncate">Due today</p>
            <p className="text-xl font-semibold text-amber-400">{s.dueToday}</p>
          </div>
        </Link>
        <Link href="/dashboard/retention?bucket=upcoming">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 sm:p-4 hover:bg-neutral-800/50 cursor-pointer">
            <p className="text-xs text-neutral-500 uppercase truncate">Upcoming</p>
            <p className="text-xl font-semibold">{s.upcoming}</p>
          </div>
        </Link>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 sm:p-4">
          <p className="text-xs text-neutral-500 uppercase truncate">Upsell open</p>
          <p className="text-xl font-semibold text-emerald-400">{s.upsellOpen}</p>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 sm:p-4">
          <p className="text-xs text-neutral-500 uppercase truncate">Retainer open</p>
          <p className="text-xl font-semibold text-emerald-400">{s.retainerOpen}</p>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 sm:p-4">
          <p className="text-xs text-neutral-500 uppercase truncate">Testimonial</p>
          <p className="text-xl font-semibold text-emerald-400">{s.testimonialReceived}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
        <div className="relative flex-1 min-w-0 sm:min-w-[200px] sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-md bg-neutral-900 border border-neutral-800 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={bucketFilter}
            onChange={(e) => setBucketFilter(e.target.value)}
            className="flex-1 sm:flex-none rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm"
          >
            <option value="all">All buckets</option>
            <option value="overdue">Overdue</option>
            <option value="today">Today</option>
            <option value="upcoming">Upcoming</option>
            <option value="none">No follow-up</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 sm:flex-none rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm"
          >
            <option value="all">All status</option>
            <option value="none">None</option>
            <option value="monitoring">Monitoring</option>
            <option value="followup_due">Follow-up due</option>
            <option value="upsell_open">Upsell open</option>
            <option value="retainer_open">Retainer open</option>
            <option value="closed_won">Closed won</option>
            <option value="closed_lost">Closed lost</option>
          </select>
        </div>
      </div>

      <AsyncState
        loading={loading}
        error={error}
        empty={!loading && !error && items.length === 0}
        emptyMessage="No projects in retention queue."
        onRetry={fetchData}
      >
        {/* Mobile card view */}
        <div className="md:hidden space-y-3">
          {items.map((p) => (
            <Link key={p.id} href={`/dashboard/delivery/${p.id}`} className="block">
              <div className="rounded-lg border border-neutral-800 p-4 hover:bg-neutral-800/30 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="font-medium text-neutral-100 truncate">{p.title ?? "—"}</p>
                    <p className="text-xs text-neutral-500">{p.clientName ?? p.company ?? "—"}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Badge variant="outline" className="capitalize text-xs">
                      {(p.retentionStatus ?? "none").replace(/_/g, " ")}
                    </Badge>
                    {p.isStale && <Badge variant="destructive" className="text-xs">stale</Badge>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-neutral-400 mt-2">
                  <div>
                    <span className="text-neutral-500">Next: </span>
                    {formatDateSafe(p.retentionNextFollowUpAt, { month: "short", day: "numeric" }) || "—"}
                  </div>
                  <div>
                    <span className="text-neutral-500">Last: </span>
                    {formatDateSafe(p.retentionLastContactedAt, { month: "short", day: "numeric" }) || "—"}
                  </div>
                  <div>
                    {p.testimonialReceivedAt ? "T✓" : p.testimonialRequestedAt ? "T?" : "—"}{" / "}
                    {p.reviewReceivedAt ? "R✓" : p.reviewRequestedAt ? "R?" : "—"}{" / "}
                    {p.referralReceivedAt ? "Ref✓" : p.referralRequestedAt ? "Ref?" : "—"}
                  </div>
                  {p.upsellOpportunity && (
                    <div className="text-emerald-400">
                      {p.upsellOpportunity}{p.upsellValueEstimate != null && ` ($${p.upsellValueEstimate})`}
                    </div>
                  )}
                </div>
                {p.retentionBucket !== "none" && (
                  <Badge
                    variant="outline"
                    className={`mt-2 text-xs capitalize ${p.retentionBucket === "overdue" ? "text-red-400 border-red-800" : p.retentionBucket === "today" ? "text-amber-400 border-amber-800" : ""}`}
                  >
                    {p.retentionBucket}
                  </Badge>
                )}
              </div>
            </Link>
          ))}
        </div>

        {/* Desktop table view */}
        <div className="hidden md:block rounded-lg border border-neutral-800 overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/50">
                <th className="text-left p-3 font-medium">Project</th>
                <th className="text-left p-3 font-medium">Retention</th>
                <th className="text-left p-3 font-medium">Next follow-up</th>
                <th className="text-left p-3 font-medium">Last contacted</th>
                <th className="text-left p-3 font-medium">T / R / Ref</th>
                <th className="text-left p-3 font-medium">Upsell</th>
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
                  <td className="p-3">
                    <Badge variant="outline" className="capitalize text-xs">
                      {(p.retentionStatus ?? "none").replace(/_/g, " ")}
                    </Badge>
                    {p.retentionBucket !== "none" && (
                      <Badge variant="outline" className="ml-1 text-xs capitalize">
                        {p.retentionBucket}
                      </Badge>
                    )}
                    {p.isStale && <span className="text-amber-400 text-xs ml-1">stale</span>}
                  </td>
                  <td className="p-3 text-neutral-400">{formatDateSafe(p.retentionNextFollowUpAt, { month: "short", day: "numeric" })}</td>
                  <td className="p-3 text-neutral-400">{formatDateSafe(p.retentionLastContactedAt, { month: "short", day: "numeric" })}</td>
                  <td className="p-3 text-neutral-400 text-xs">
                    {p.testimonialReceivedAt ? "T✓" : p.testimonialRequestedAt ? "T?" : "—"} /{" "}
                    {p.reviewReceivedAt ? "R✓" : p.reviewRequestedAt ? "R?" : "—"} /{" "}
                    {p.referralReceivedAt ? "Ref✓" : p.referralRequestedAt ? "Ref?" : "—"}
                  </td>
                  <td className="p-3 text-neutral-400">
                    {p.upsellOpportunity ? (
                      <span>
                        {p.upsellOpportunity}
                        {p.upsellValueEstimate != null && ` ($${p.upsellValueEstimate})`}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <Link href={`/dashboard/delivery/${p.id}`}>
                      <Button variant="ghost" size="sm" disabled={!!actionLoading}>
                        Open
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
