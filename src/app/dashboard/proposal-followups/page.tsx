"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { AsyncState } from "@/components/ui/AsyncState";
import { formatDateSafe } from "@/lib/ui/date-safe";

type ProposalItem = {
  id: string;
  title: string;
  company: string | null;
  clientName: string | null;
  status: string;
  responseStatus: string;
  sentAt: string | null;
  nextFollowUpAt: string | null;
  lastContactedAt: string | null;
  followUpCount: number;
  intakeLeadId: string | null;
};

type ApiResponse = {
  overdue: ProposalItem[];
  today: ProposalItem[];
  upcoming: ProposalItem[];
  stale: ProposalItem[];
  noFollowup: ProposalItem[];
  totals: { overdue: number; today: number; upcoming: number; stale: number; noFollowup: number };
};

const BUCKET_KEYS = ["overdue", "today", "upcoming", "stale", "noFollowup"] as const;

function getBucketItems(data: ApiResponse, bucket: string): ProposalItem[] {
  const key = bucket === "no_followup" ? "noFollowup" : bucket;
  if (!BUCKET_KEYS.includes(key as (typeof BUCKET_KEYS)[number])) return [];
  const val = data[key as (typeof BUCKET_KEYS)[number]];
  return Array.isArray(val) ? val : [];
}

const BUCKETS = ["overdue", "today", "upcoming", "stale", "no_followup"] as const;

function ProposalRow({
  item,
  bucket,
  onSnooze,
  onLogEmail,
  onLogCall,
  onComplete,
  actionLoading,
}: {
  item: ProposalItem;
  bucket: string;
  onSnooze: (i: ProposalItem) => void;
  onLogEmail: (i: ProposalItem) => void;
  onLogCall: (i: ProposalItem) => void;
  onComplete: (i: ProposalItem) => void;
  actionLoading: string | null;
}) {
  const loading = actionLoading === item.id;
  return (
    <tr className="border-b border-neutral-800 hover:bg-neutral-800/30">
      <td className="p-3">
        <Link href={`/dashboard/proposals/${item.id}`} className="font-medium text-neutral-100 hover:underline">
          {item.title || "—"}
        </Link>
      </td>
      <td className="p-3 text-neutral-300">{item.company ?? item.clientName ?? "—"}</td>
      <td className="p-3">
        <span className="text-xs text-neutral-500 capitalize">{(item.responseStatus ?? "none").replace(/_/g, " ")}</span>
      </td>
      <td className="p-3 text-neutral-400">{formatDateSafe(item.nextFollowUpAt)}</td>
      <td className="p-3 text-neutral-400">{formatDateSafe(item.lastContactedAt)}</td>
      <td className="p-3 text-neutral-400">{item.followUpCount ?? 0}</td>
      <td className="p-3">
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => onLogEmail(item)} disabled={loading}>Email</Button>
          <Button variant="ghost" size="sm" onClick={() => onLogCall(item)} disabled={loading}>Call</Button>
          <Button variant="ghost" size="sm" onClick={() => onSnooze(item)} disabled={loading}>Snooze</Button>
          <Button variant="ghost" size="sm" onClick={() => onComplete(item)} disabled={loading}>Complete</Button>
          <Link href={`/dashboard/proposals/${item.id}`}>
            <Button variant="ghost" size="sm">Open</Button>
          </Link>
        </div>
      </td>
    </tr>
  );
}

export default function ProposalFollowupsPage() {
  const searchParams = useSearchParams();
  const bucketParam = searchParams.get("bucket") ?? "all";
  const [data, setData] = useState<ApiResponse | null>(null);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [bucketFilter, setBucketFilter] = useState<string>(bucketParam);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [snoozeItem, setSnoozeItem] = useState<ProposalItem | null>(null);
  const [snoozePreset, setSnoozePreset] = useState<"2d" | "5d" | "next_monday">("2d");

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
      const [res, sumRes] = await Promise.all([
        fetch(`/api/proposals/followups?${params}`, { credentials: "include", signal: controller.signal, cache: "no-store" }),
        fetch("/api/proposals/followup-summary", { credentials: "include", signal: controller.signal, cache: "no-store" }),
      ]);
      const json = await res.json().catch(() => null);
      const sumJson = await sumRes.json().catch(() => null);
      if (controller.signal.aborted || runId !== runIdRef.current) return;
      if (res.ok && json) setData(json);
      else {
        setData(null);
        setError(typeof json?.error === "string" ? json.error : `Failed to load (${res.status})`);
      }
      if (sumRes.ok && sumJson) setSummary(sumJson);
      else setSummary(null);
    } catch (e) {
      if (controller.signal.aborted || runId !== runIdRef.current) return;
      if (e instanceof Error && (e.name === "AbortError" || e.message?.includes("aborted"))) return;
      setError(e instanceof Error ? e.message : "Failed to load");
      setData(null);
      setSummary(null);
    } finally {
      if (runId === runIdRef.current) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }, [debouncedSearch, bucketFilter]);

  useEffect(() => {
    setBucketFilter(bucketParam);
  }, [bucketParam]);

  useEffect(() => {
    void fetchData();
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [fetchData]);

  const runAction = async (itemId: string, fn: () => Promise<Response>) => {
    setActionLoading(itemId);
    try {
      const res = await fn();
      const json = await res.json().catch(() => null);
      if (!res.ok) alert(json?.error ?? "Action failed");
      else void fetchData();
    } finally {
      setActionLoading(null);
    }
  };

  const handleSnooze = (item: ProposalItem) => setSnoozeItem(item);
  const handleSnoozeSubmit = () => {
    if (!snoozeItem) return;
    runAction(snoozeItem.id, () =>
      fetch(`/api/proposals/${snoozeItem.id}/followup-snooze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preset: snoozePreset }),
      })
    );
    setSnoozeItem(null);
  };

  const handleLogEmail = (item: ProposalItem) => {
    runAction(item.id, () =>
      fetch(`/api/proposals/${item.id}/followup-log-email`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
    );
  };
  const handleLogCall = (item: ProposalItem) => {
    runAction(item.id, () =>
      fetch(`/api/proposals/${item.id}/followup-log-call`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
    );
  };
  const handleComplete = (item: ProposalItem) => {
    runAction(item.id, () =>
      fetch(`/api/proposals/${item.id}/followup-complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
    );
  };

  if (loading && !data) {
    return <div className="py-12 text-center text-neutral-500">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Proposal Follow-ups</h1>
        <p className="text-sm text-neutral-400 mt-1">Track and schedule follow-ups for sent proposals.</p>
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="rounded-lg border border-neutral-800 p-4">
            <div className="text-2xl font-semibold text-amber-400">{summary.dueToday ?? 0}</div>
            <div className="text-xs text-neutral-500">Due today</div>
          </div>
          <div className="rounded-lg border border-neutral-800 p-4">
            <div className="text-2xl font-semibold text-red-400">{summary.overdue ?? 0}</div>
            <div className="text-xs text-neutral-500">Overdue</div>
          </div>
          <div className="rounded-lg border border-neutral-800 p-4">
            <div className="text-2xl font-semibold text-red-400">{summary.stale ?? 0}</div>
            <div className="text-xs text-neutral-500">Stale</div>
          </div>
          <div className="rounded-lg border border-neutral-800 p-4">
            <div className="text-2xl font-semibold text-amber-400">{data?.totals?.noFollowup ?? 0}</div>
            <div className="text-xs text-neutral-500">No follow-up date</div>
          </div>
          <div className="rounded-lg border border-neutral-800 p-4">
            <div className="text-2xl font-semibold text-emerald-400">{summary.meetingBookedThisWeek ?? 0}</div>
            <div className="text-xs text-neutral-500">Meetings this week</div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
          <Input
            placeholder="Search title, company, contact..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-neutral-900 border-neutral-700"
          />
        </div>
        <div className="flex gap-2">
          {["all", ...BUCKETS].map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBucketFilter(b)}
              className={`px-3 py-1.5 rounded-md text-sm ${
                bucketFilter === b
                  ? "bg-amber-600/30 text-amber-400 border border-amber-700"
                  : "bg-neutral-800/50 text-neutral-400 border border-neutral-700 hover:bg-neutral-700/50"
              }`}
            >
              {b === "all" ? "All" : b}
            </button>
          ))}
        </div>
      </div>

      {snoozeItem && (
        <div className="rounded-lg border border-amber-800/50 bg-amber-900/20 p-4 flex gap-2 items-center">
          <span className="text-sm">Snooze {snoozeItem.title}</span>
          <select
            value={snoozePreset}
            onChange={(e) => setSnoozePreset(e.target.value as "2d" | "5d" | "next_monday")}
            className="rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-sm"
          >
            <option value="2d">+2 days</option>
            <option value="5d">+5 days</option>
            <option value="next_monday">Next Monday</option>
          </select>
          <Button size="sm" onClick={handleSnoozeSubmit}>Snooze</Button>
          <Button variant="ghost" size="sm" onClick={() => setSnoozeItem(null)}>Cancel</Button>
        </div>
      )}

      <AsyncState
        loading={loading}
        error={error}
        empty={!loading && !error && !data}
        emptyMessage="No proposal follow-ups in queue."
        onRetry={fetchData}
      >
        {data ? (
        <div className="space-y-6">
          {BUCKETS.map((bucket) => {
            const items = getBucketItems(data, bucket);
            if (items.length === 0) return null;
            return (
              <div key={bucket} className="rounded-lg border border-neutral-800 overflow-hidden">
                <h3 className="text-sm font-medium text-neutral-400 px-4 py-2 bg-neutral-900/50 border-b border-neutral-800 capitalize">
                  {bucket}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-700 bg-neutral-900/50">
                        <th className="text-left p-3 font-medium text-neutral-400">Proposal</th>
                        <th className="text-left p-3 font-medium text-neutral-400">Company</th>
                        <th className="text-left p-3 font-medium text-neutral-400">Response</th>
                        <th className="text-left p-3 font-medium text-neutral-400">Next follow-up</th>
                        <th className="text-left p-3 font-medium text-neutral-400">Last contacted</th>
                        <th className="text-left p-3 font-medium text-neutral-400">Count</th>
                        <th className="text-left p-3 font-medium text-neutral-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <ProposalRow
                          key={item.id}
                          item={item}
                          bucket={bucket}
                          onSnooze={handleSnooze}
                          onLogEmail={handleLogEmail}
                          onLogCall={handleLogCall}
                          onComplete={handleComplete}
                          actionLoading={actionLoading}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          {data.overdue?.length === 0 && data.today?.length === 0 && data.upcoming?.length === 0 && data.stale?.length === 0 && data.noFollowup?.length === 0 && (
            <div className="py-12 text-center text-neutral-500 border border-dashed border-neutral-700 rounded-lg">
              No proposal follow-ups in queue.
            </div>
          )}
        </div>
        ) : null}
      </AsyncState>
    </div>
  );
}
