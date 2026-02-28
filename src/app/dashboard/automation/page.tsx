"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Zap, Check, X, ExternalLink } from "lucide-react";
import { AsyncState } from "@/components/ui/AsyncState";

type Suggestion = {
  id: string;
  type: string;
  title: string;
  reason: string;
  status: string;
  priority: string;
  actionUrl: string | null;
  createdAt: string;
};

type Summary = {
  pending: number;
  highPriority: number;
  appliedThisWeek: number;
};

function priorityColor(p: string): string {
  if (p === "critical") return "bg-red-500/20 text-red-400";
  if (p === "high") return "bg-amber-500/20 text-amber-400";
  if (p === "medium") return "bg-neutral-500/20 text-neutral-300";
  return "bg-neutral-600/20 text-neutral-500";
}

export default function AutomationPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generateLoading, setGenerateLoading] = useState(false);
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
      const [data, sum] = await Promise.all([
        fetch("/api/automation-suggestions?status=pending", { credentials: "include", signal: controller.signal, cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
        fetch("/api/automation-suggestions/summary", { credentials: "include", signal: controller.signal, cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
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
  }, []);

  useEffect(() => {
    void fetchData();
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [fetchData]);

  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerateLoading(true);
    try {
      const res = await fetch("/api/automation-suggestions/generate", { method: "POST" });
      if (res.ok) fetchData();
      else {
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
      if (res.ok && data.success) fetchData();
      else if (data.error) toast.error(data.error);
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
      if (res.ok) fetchData();
      else toast.error("Failed to reject suggestion");
    } catch {
      toast.error("Failed to reject suggestion");
    } finally {
      setMutatingId(null);
    }
  };

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Automation Suggestions</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Suggested actions from current system state. Manual approval required.
          </p>
        </div>
        <Button size="sm" onClick={handleGenerate} disabled={generateLoading}>
          <Zap className="w-4 h-4 mr-1" />
          {generateLoading ? "Generating…" : "Generate Suggestions"}
        </Button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
            <p className="text-xs text-neutral-500">Pending</p>
            <p className="text-xl font-semibold">{summary.pending}</p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
            <p className="text-xs text-neutral-500">High Priority</p>
            <p className="text-xl font-semibold text-amber-400">{summary.highPriority}</p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
            <p className="text-xs text-neutral-500">Applied This Week</p>
            <p className="text-xl font-semibold text-emerald-400">{summary.appliedThisWeek}</p>
          </div>
        </div>
      )}

      {/* Suggestions list */}
      <AsyncState
        loading={loading}
        error={error}
        empty={!loading && !error && suggestions.length === 0}
        emptyMessage='No pending suggestions. Click "Generate Suggestions" to scan current state.'
        onRetry={fetchData}
      >
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 overflow-hidden">
          <div className="divide-y divide-neutral-800">
            {suggestions.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center gap-3 p-4 hover:bg-neutral-800/30"
              >
                <Badge className={priorityColor(s.priority)}>{s.priority}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{s.title}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{s.reason}</p>
                  <span className="text-xs text-neutral-400">{s.type}</span>
                </div>
                <div className="flex gap-2 shrink-0">
                  {s.actionUrl && (
                    <Link href={s.actionUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </Link>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleApply(s.id)}
                    disabled={mutatingId !== null}
                    className="text-emerald-400"
                  >
                    <Check className="w-4 h-4 mr-1" />
                    {mutatingId === s.id ? "…" : "Apply"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReject(s.id)}
                    disabled={mutatingId !== null}
                    className="text-neutral-400"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </AsyncState>

      <Button variant="outline" size="sm" onClick={fetchData}>
        <RefreshCw className="w-4 h-4 mr-1" />
        Refresh
      </Button>

      <Link href="/dashboard/reminders" className="block text-sm text-amber-400 hover:underline">
        Open Reminders →
      </Link>
    </div>
  );
}
