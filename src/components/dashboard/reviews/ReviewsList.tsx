"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Circle, ChevronDown, ChevronRight, X } from "lucide-react";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { AsyncState } from "@/components/ui/AsyncState";
import { fetchJsonThrow } from "@/lib/http/fetch-json";

type ReviewItem = {
  id: string;
  weekStart: string;
  phase: string | null;
  activeCampaignName: string | null;
  reviewChecks: number;
  reviewTotal: number;
  biggestBottleneck: string | null;
  score: number | null;
  completedAt: string | null;
  whatWorked: string | null;
  whatFailed: string | null;
  whatChanged: string | null;
  nextWeekCommitments: string | null;
};

export function ReviewsList() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [completing, setCompleting] = useState<ReviewItem | null>(null);
  const [formScore, setFormScore] = useState("");
  const [formWhatWorked, setFormWhatWorked] = useState("");
  const [formWhatFailed, setFormWhatFailed] = useState("");
  const [formWhatChanged, setFormWhatChanged] = useState("");
  const [formNextWeek, setFormNextWeek] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const toastFn = (m: string, t?: "success" | "error") => t === "error" ? toast.error(m) : toast.success(m);

  const refetch = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ops/strategy-week/history?weeks=12", { credentials: "include", signal: controller.signal, cache: "no-store" });
      if (controller.signal.aborted) return;
      if (!res.ok) { setError("Failed to load reviews"); return; }
      const data = await res.json();
      setItems(data?.items ?? []);
    } catch (e) {
      if (controller.signal.aborted) return;
      if (e instanceof Error && (e.name === "AbortError" || e.message?.includes("aborted"))) return;
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    void refetch();
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [refetch]);

  function openComplete(item: ReviewItem) {
    setCompleting(item);
    setFormScore(item.score?.toString() ?? "");
    setFormWhatWorked(item.whatWorked ?? "");
    setFormWhatFailed(item.whatFailed ?? "");
    setFormWhatChanged(item.whatChanged ?? "");
    setFormNextWeek(item.nextWeekCommitments ?? "");
  }

  const { execute: submitComplete, pending: saving } = useAsyncAction(
    async () => {
      if (!completing) throw new Error("No review selected");
      return fetchJsonThrow(
        `/api/ops/strategy-week/review?weekStart=${encodeURIComponent(completing.weekStart)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            score: formScore ? parseInt(formScore, 10) : undefined,
            whatWorked: formWhatWorked || undefined,
            whatFailed: formWhatFailed || undefined,
            whatChanged: formWhatChanged || undefined,
            nextWeekCommitments: formNextWeek || undefined,
            complete: true,
          }),
        }
      );
    },
    {
      toast: toastFn,
      successMessage: "Weekly review saved",
      onSuccess: () => {
        setCompleting(null);
        void refetch();
      },
    },
  );

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 overflow-hidden">
      <AsyncState loading={loading} error={error} empty={!loading && !error && items.length === 0} emptyMessage="No strategy weeks yet." onRetry={refetch}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-neutral-500 text-xs uppercase tracking-wider bg-neutral-900/80">
              <th className="px-4 py-3 w-8" />
              <th className="px-4 py-3">Week</th>
              <th className="px-4 py-3">Phase</th>
              <th className="px-4 py-3">Campaign</th>
              <th className="px-4 py-3">Checks</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isExpanded = expandedId === item.id;
              const isComplete = !!item.completedAt;
              const weekLabel = formatWeekRange(item.weekStart);
              return (
                <React.Fragment key={item.id}>
                  <tr
                    className="border-t border-neutral-800 hover:bg-neutral-800/30"
                  >
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        className="text-neutral-500 hover:text-neutral-300"
                        aria-label={isExpanded ? "Collapse" : "Expand"}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-neutral-300">{weekLabel}</td>
                    <td className="px-4 py-2 text-neutral-400">{item.phase || "—"}</td>
                    <td className="px-4 py-2 text-neutral-400 truncate max-w-[180px]">
                      {item.activeCampaignName || "—"}
                    </td>
                    <td className="px-4 py-2 text-neutral-400">
                      {item.reviewChecks}/{item.reviewTotal}
                    </td>
                    <td className="px-4 py-2">
                      {item.score != null ? (
                        <Badge variant="outline" className="text-emerald-400 border-emerald-700">
                          {item.score}
                        </Badge>
                      ) : (
                        <span className="text-neutral-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {isComplete ? (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          Done
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-neutral-500">
                          <Circle className="w-4 h-4" />
                          Incomplete
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openComplete(item)}
                      >
                        {isComplete ? "Edit" : "Complete"}
                      </Button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${item.id}-detail`} className="border-t border-neutral-800 bg-neutral-950/50">
                      <td colSpan={8} className="px-4 py-4">
                        <div className="grid gap-4 sm:grid-cols-2 text-sm max-w-3xl">
                          {item.biggestBottleneck && (
                            <div>
                              <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">
                                Biggest bottleneck
                              </p>
                              <p className="text-neutral-300">{item.biggestBottleneck}</p>
                            </div>
                          )}
                          {item.whatWorked && (
                            <div>
                              <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">
                                What worked
                              </p>
                              <p className="text-neutral-300 whitespace-pre-wrap">{item.whatWorked}</p>
                            </div>
                          )}
                          {item.whatFailed && (
                            <div>
                              <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">
                                What failed
                              </p>
                              <p className="text-neutral-300 whitespace-pre-wrap">{item.whatFailed}</p>
                            </div>
                          )}
                          {item.whatChanged && (
                            <div>
                              <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">
                                What changed
                              </p>
                              <p className="text-neutral-300 whitespace-pre-wrap">{item.whatChanged}</p>
                            </div>
                          )}
                          {item.nextWeekCommitments && (
                            <div>
                              <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">
                                Next week commitments
                              </p>
                              <p className="text-neutral-300 whitespace-pre-wrap">{item.nextWeekCommitments}</p>
                            </div>
                          )}
                          {!item.biggestBottleneck && !item.whatWorked && !item.whatFailed && !item.whatChanged && !item.nextWeekCommitments && (
                            <p className="text-neutral-500 col-span-2">
                              No review details yet.{" "}
                              <button
                                type="button"
                                onClick={() => openComplete(item)}
                                className="text-neutral-300 hover:underline"
                              >
                                Complete this review
                              </button>
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      </AsyncState>

      {/* Complete review modal */}
      {completing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => setCompleting(null)}
            aria-label="Close"
          />
          <div className="relative w-full max-w-lg rounded-lg border border-neutral-700 bg-neutral-950 p-6 shadow-xl mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-neutral-200">
                Complete review — {formatWeekRange(completing.weekStart)}
              </h3>
              <button
                type="button"
                onClick={() => setCompleting(null)}
                className="text-neutral-500 hover:text-neutral-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Score (0–100)</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={formScore}
                  onChange={(e) => setFormScore(e.target.value)}
                  placeholder="e.g. 75"
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">What worked</label>
                <Textarea
                  value={formWhatWorked}
                  onChange={(e) => setFormWhatWorked(e.target.value)}
                  placeholder="What went well?"
                  rows={2}
                  className="w-full rounded-md border border-neutral-600 bg-neutral-900"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">What failed</label>
                <Textarea
                  value={formWhatFailed}
                  onChange={(e) => setFormWhatFailed(e.target.value)}
                  placeholder="What didn’t work?"
                  rows={2}
                  className="w-full rounded-md border border-neutral-600 bg-neutral-900"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">What changed</label>
                <Textarea
                  value={formWhatChanged}
                  onChange={(e) => setFormWhatChanged(e.target.value)}
                  placeholder="What shifted or pivoted?"
                  rows={2}
                  className="w-full rounded-md border border-neutral-600 bg-neutral-900"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Next week commitments</label>
                <Textarea
                  value={formNextWeek}
                  onChange={(e) => setFormNextWeek(e.target.value)}
                  placeholder="What will you commit to next week?"
                  rows={2}
                  className="w-full rounded-md border border-neutral-600 bg-neutral-900"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={() => void submitComplete()} disabled={saving}>
                {saving ? "Saving…" : "Mark complete"}
              </Button>
              <Button variant="outline" onClick={() => setCompleting(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function formatWeekRange(weekStart: string): string {
  try {
    const start = new Date(weekStart);
    if (Number.isNaN(start.getTime())) return "—";
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  } catch {
    return "—";
  }
}
