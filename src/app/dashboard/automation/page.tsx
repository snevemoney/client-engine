"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  Zap,
  Check,
  X,
  ExternalLink,
  Loader2,
  Clock,
  AlertTriangle,
  Inbox,
  ChevronDown,
} from "lucide-react";
import { AsyncState } from "@/components/ui/AsyncState";

type Suggestion = {
  id: string;
  type: string;
  title: string;
  reason: string;
  status: string;
  priority: string;
  sourceType: string | null;
  actionUrl: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

type Summary = {
  pending: number;
  highPriority: number;
  appliedThisWeek: number;
};

type StatusFilter = "pending" | "applied" | "rejected" | "all";

function priorityColor(p: string): string {
  if (p === "critical") return "bg-red-500/20 text-red-400 border-red-500/30";
  if (p === "high") return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  if (p === "medium") return "bg-neutral-500/20 text-neutral-300 border-neutral-500/30";
  return "bg-neutral-600/20 text-neutral-500 border-neutral-600/30";
}

function typeLabel(t: string): string {
  return t
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(date: string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function AutomationPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);

  const fetchData = useCallback(async (filter: StatusFilter = statusFilter) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const runId = ++runIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const statusParam = filter === "all" ? "" : `status=${filter}`;
      const [data, sum] = await Promise.all([
        fetch(`/api/automation-suggestions?${statusParam}&pageSize=50`, {
          credentials: "include",
          signal: controller.signal,
          cache: "no-store",
        }).then((r) => (r.ok ? r.json() : null)),
        fetch("/api/automation-suggestions/summary", {
          credentials: "include",
          signal: controller.signal,
          cache: "no-store",
        }).then((r) => (r.ok ? r.json() : null)),
      ]);
      if (controller.signal.aborted || runId !== runIdRef.current) return;
      setSuggestions(data?.items ?? data?.suggestions ?? []);
      setSummary(sum ?? null);
    } catch (e) {
      if (controller.signal.aborted || runId !== runIdRef.current) return;
      if (e instanceof Error && (e.name === "AbortError" || e.message?.includes("aborted"))) return;
      setError(e instanceof Error ? e.message : "Failed to load");
      setSuggestions([]);
    } finally {
      if (runId === runIdRef.current) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }, [statusFilter]);

  useEffect(() => {
    void fetchData();
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [fetchData]);

  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerateLoading(true);
    try {
      const res = await fetch("/api/automation-suggestions/generate", { method: "POST" });
      if (res.ok) {
        toast.success("Suggestions generated");
        fetchData();
      } else {
        const d = await res.json().catch(() => null);
        toast.error(d?.error ?? "Generate failed");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setGenerateLoading(false);
    }
  };

  const handleApply = async (id: string) => {
    setMutatingId(id);
    try {
      const res = await fetch(`/api/automation-suggestions/${id}/apply`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.action ?? "Applied");
        fetchData();
      } else if (data.error) toast.error(data.error);
    } catch {
      toast.error("Failed to apply suggestion");
    } finally {
      setMutatingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setMutatingId(id);
    try {
      const res = await fetch(`/api/automation-suggestions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      });
      if (res.ok) {
        toast.success("Dismissed");
        fetchData();
      } else toast.error("Failed to dismiss");
    } catch {
      toast.error("Failed to dismiss");
    } finally {
      setMutatingId(null);
    }
  };

  const changeFilter = (f: StatusFilter) => {
    setStatusFilter(f);
    fetchData(f);
  };

  // Group suggestions by type
  const grouped = suggestions.reduce<Record<string, Suggestion[]>>((acc, s) => {
    const key = s.type;
    if (!acc[key]) acc[key] = [];
    acc[key]!.push(s);
    return acc;
  }, {});

  const filterTabs: { key: StatusFilter; label: string; count?: number }[] = [
    { key: "pending", label: "Pending", count: summary?.pending },
    { key: "applied", label: "Applied" },
    { key: "rejected", label: "Dismissed" },
    { key: "all", label: "All" },
  ];

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Automation</h1>
          <p className="text-sm text-neutral-400 mt-1">
            AI-generated actions based on your pipeline, deals, and system state. You approve everything.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => fetchData()}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Refresh
          </Button>
          <Button size="sm" onClick={handleGenerate} disabled={generateLoading}>
            {generateLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                Scanning…
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 mr-1" />
                Scan for actions
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => changeFilter("pending")}
            className={`rounded-lg border p-3 text-left transition-colors ${
              statusFilter === "pending"
                ? "border-neutral-600 bg-neutral-800/60"
                : "border-neutral-800 bg-neutral-900/50 hover:border-neutral-700"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Inbox className="w-3.5 h-3.5 text-neutral-500" />
              <p className="text-xs text-neutral-500">Pending</p>
            </div>
            <p className="text-xl font-semibold mt-1">{summary.pending}</p>
          </button>
          <button
            onClick={() => changeFilter("pending")}
            className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 text-left hover:border-neutral-700 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <p className="text-xs text-neutral-500">High priority</p>
            </div>
            <p className="text-xl font-semibold text-amber-400 mt-1">{summary.highPriority}</p>
          </button>
          <button
            onClick={() => changeFilter("applied")}
            className={`rounded-lg border p-3 text-left transition-colors ${
              statusFilter === "applied"
                ? "border-neutral-600 bg-neutral-800/60"
                : "border-neutral-800 bg-neutral-900/50 hover:border-neutral-700"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <p className="text-xs text-neutral-500">Applied this week</p>
            </div>
            <p className="text-xl font-semibold text-emerald-400 mt-1">{summary.appliedThisWeek}</p>
          </button>
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 border-b border-neutral-800 pb-px">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => changeFilter(tab.key)}
            className={`px-3 py-1.5 text-sm font-medium rounded-t transition-colors ${
              statusFilter === tab.key
                ? "text-neutral-100 border-b-2 border-amber-500"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span className="ml-1.5 text-xs bg-neutral-800 rounded-full px-1.5 py-0.5">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Suggestions list */}
      <AsyncState
        loading={loading}
        error={error}
        empty={!loading && !error && suggestions.length === 0}
        emptyMessage={
          statusFilter === "pending"
            ? "No pending suggestions. Click \"Scan for actions\" to analyze your current pipeline and generate recommendations."
            : `No ${statusFilter === "all" ? "" : statusFilter + " "}suggestions found.`
        }
        onRetry={fetchData}
      >
        <div className="space-y-4">
          {Object.entries(grouped).map(([type, items]) => (
            <div key={type}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  {typeLabel(type)}
                </h3>
                <span className="text-[10px] text-neutral-600">{items.length}</span>
              </div>
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 overflow-hidden">
                <div className="divide-y divide-neutral-800">
                  {items.map((s) => {
                    const isExpanded = expandedId === s.id;
                    const isPending = s.status === "pending";
                    return (
                      <div
                        key={s.id}
                        className={`p-4 transition-colors ${
                          isPending ? "hover:bg-neutral-800/30" : "opacity-70"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Badge className={`shrink-0 mt-0.5 ${priorityColor(s.priority)}`}>
                            {s.priority}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : s.id)}
                              className="flex items-center gap-1.5 text-left group"
                            >
                              <p className="font-medium text-sm group-hover:text-neutral-100 transition-colors">
                                {s.title}
                              </p>
                              <ChevronDown
                                className={`w-3.5 h-3.5 text-neutral-600 transition-transform ${
                                  isExpanded ? "rotate-180" : ""
                                }`}
                              />
                            </button>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Clock className="w-3 h-3 text-neutral-600" />
                              <span className="text-[11px] text-neutral-500">
                                {timeAgo(s.createdAt)}
                              </span>
                              {s.status !== "pending" && (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${
                                    s.status === "applied"
                                      ? "text-emerald-400 border-emerald-800/50"
                                      : "text-neutral-500 border-neutral-700"
                                  }`}
                                >
                                  {s.status}
                                </Badge>
                              )}
                            </div>
                            {isExpanded && (
                              <div className="mt-3 space-y-2">
                                <p className="text-sm text-neutral-400 leading-relaxed">{s.reason}</p>
                                {s.sourceType && (
                                  <p className="text-[11px] text-neutral-600">
                                    Source: {s.sourceType}
                                    {s.actionUrl && (
                                      <>
                                        {" "}·{" "}
                                        <Link
                                          href={s.actionUrl}
                                          className="text-amber-500 hover:underline"
                                        >
                                          View related
                                        </Link>
                                      </>
                                    )}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                          {isPending && (
                            <div className="flex gap-1.5 shrink-0">
                              {s.actionUrl && (
                                <Link href={s.actionUrl} target="_blank" rel="noopener noreferrer">
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </Button>
                                </Link>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleApply(s.id)}
                                disabled={mutatingId !== null}
                                className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/30 h-8"
                              >
                                {mutatingId === s.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <>
                                    <Check className="w-3.5 h-3.5 mr-1" />
                                    Apply
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleReject(s.id)}
                                disabled={mutatingId !== null}
                                className="text-neutral-500 hover:text-neutral-300 h-8"
                              >
                                <X className="w-3.5 h-3.5 mr-1" />
                                Dismiss
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </AsyncState>
    </div>
  );
}
