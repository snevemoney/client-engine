"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, TrendingUp, ChevronRight } from "lucide-react";
import { gradeToColor } from "@/lib/operator-score/trends";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AsyncState } from "@/components/ui/AsyncState";
import { fetchJsonThrow } from "@/lib/http/fetch-json";

type ScoreData = {
  score: number;
  grade: string;
  breakdown: Record<string, { score: number; max: number; label: string }>;
  summary: string;
  topWins: string[];
  topRisks: string[];
  deltaVsPrev: { current: number; previous: number; delta: number; deltaPercent: number; direction: string };
};

type OperatorScoreData = {
  weekly: ScoreData;
  monthly: ScoreData;
  weekStart: string;
  monthStart: string;
};

export default function OperatorPage() {
  const [data, setData] = useState<OperatorScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyWeekly, setHistoryWeekly] = useState<{ periodStart: string; score: number; grade: string }[]>([]);
  const [historyMonthly, setHistoryMonthly] = useState<{ periodStart: string; score: number; grade: string }[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const toastFn = (m: string, t?: "success" | "error") => t === "error" ? toast.error(m) : toast.success(m);
  const { confirm, dialogProps } = useConfirmDialog();

  const fetchData = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const [current, histW, histM] = await Promise.all([
        fetch("/api/operator-score/current", { credentials: "include", signal: controller.signal, cache: "no-store" }).then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load operator score")))),
        fetch("/api/operator-score/history?periodType=weekly&limit=8", { credentials: "include", signal: controller.signal, cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
        fetch("/api/operator-score/history?periodType=monthly&limit=6", { credentials: "include", signal: controller.signal, cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      ]);
      if (controller.signal.aborted) return;
      setData(current && typeof current === "object" ? current : null);
      setHistoryWeekly(histW?.items ?? []);
      setHistoryMonthly(histM?.items ?? []);
    } catch (e) {
      if (controller.signal.aborted) return;
      if (e instanceof Error && (e.name === "AbortError" || e.message?.includes("aborted"))) return;
      setError(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    void fetchData();
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [fetchData]);

  const { execute: handleSnapshot, pending: snapshotLoading } = useAsyncAction(
    async () => fetchJsonThrow("/api/operator-score/snapshot", { method: "POST" }),
    { toast: toastFn, successMessage: "Score snapshot captured", onSuccess: () => void fetchData() },
  );

  const onSnapshotClick = async () => {
    if (!(await confirm({ title: "Capture score snapshot?", body: "This will record a point-in-time snapshot of the current operator score." }))) return;
    void handleSnapshot();
  };

  const w = data?.weekly ?? { score: 0, grade: "—", breakdown: {}, summary: "", topWins: [], topRisks: [], deltaVsPrev: { delta: 0, direction: "flat" } };
  const m = data?.monthly ?? { score: 0, grade: "—", breakdown: {}, summary: "", topWins: [], topRisks: [], deltaVsPrev: { delta: 0, direction: "flat" } };

  const breakdownOrder = [
    "pipelineHygiene",
    "conversionHealth",
    "deliveryExecution",
    "proofRetention",
    "cadenceDiscipline",
  ];

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Operator Score</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Performance and execution quality across pipeline, conversion, delivery, proof, and cadence.
          </p>
        </div>
        <Button size="sm" onClick={onSnapshotClick} disabled={snapshotLoading}>
          {snapshotLoading ? "Capturing…" : "Capture Score Snapshot"}
        </Button>
      </div>
      <ConfirmDialog {...dialogProps} />
      <AsyncState loading={loading} error={error} empty={!loading && !error && !data} emptyMessage="No operator score data" onRetry={fetchData}>

      {/* Score header */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
          <p className="text-xs text-neutral-500 uppercase mb-1">Weekly Score</p>
          <div className="flex items-baseline gap-3">
            <span className={`text-4xl font-bold ${gradeToColor(w.grade)}`}>{w.score}</span>
            <Badge variant="outline" className={gradeToColor(w.grade)}>
              {w.grade}
            </Badge>
            {w.deltaVsPrev?.delta !== 0 && (
              <span className={`text-sm ${w.deltaVsPrev.direction === "up" ? "text-emerald-400" : w.deltaVsPrev.direction === "down" ? "text-red-400" : "text-neutral-400"}`}>
                {w.deltaVsPrev.direction === "up" ? "+" : ""}{w.deltaVsPrev.delta} vs last week
              </span>
            )}
          </div>
          <p className="text-sm text-neutral-400 mt-2">{w.summary}</p>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
          <p className="text-xs text-neutral-500 uppercase mb-1">Monthly Score</p>
          <div className="flex items-baseline gap-3">
            <span className={`text-4xl font-bold ${gradeToColor(m.grade)}`}>{m.score}</span>
            <Badge variant="outline" className={gradeToColor(m.grade)}>
              {m.grade}
            </Badge>
            {m.deltaVsPrev?.delta !== 0 && (
              <span className={`text-sm ${m.deltaVsPrev.direction === "up" ? "text-emerald-400" : m.deltaVsPrev.direction === "down" ? "text-red-400" : "text-neutral-400"}`}>
                {m.deltaVsPrev.direction === "up" ? "+" : ""}{m.deltaVsPrev.delta} vs last month
              </span>
            )}
          </div>
          <p className="text-sm text-neutral-400 mt-2">{m.summary}</p>
        </div>
      </div>

      {/* Score breakdown */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">Score Breakdown</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {breakdownOrder.map((key) => {
            const b = (w.breakdown as Record<string, { score: number; max: number; label: string }> | undefined)?.[key];
            if (!b) return null;
            const pct = b.max > 0 ? Math.round((b.score / b.max) * 100) : 0;
            return (
              <div key={key} className="space-y-1">
                <p className="text-xs text-neutral-500">{b.label}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500/80 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-neutral-400 shrink-0">
                    {b.score}/{b.max}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Wins / Top Risks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-neutral-300 mb-2">Top Wins</h2>
          <ul className="space-y-1 text-sm">
            {(w.topWins ?? []).length > 0 ? (
              (w.topWins ?? []).map((item, i) => (
                <li key={i} className="text-emerald-400/90 flex items-center gap-2">
                  <span className="text-emerald-500">•</span> {item}
                </li>
              ))
            ) : (
              <li className="text-neutral-500">—</li>
            )}
          </ul>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-neutral-300 mb-2">Top Risks</h2>
          <ul className="space-y-1 text-sm">
            {(w.topRisks ?? []).length > 0 ? (
              (w.topRisks ?? []).map((item, i) => (
                <li key={i} className="text-amber-400/90 flex items-center gap-2">
                  <span className="text-amber-500">•</span> {item}
                </li>
              ))
            ) : (
              <li className="text-neutral-500">—</li>
            )}
          </ul>
        </div>
      </div>

      {/* Score trend */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">Score Trend</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs text-neutral-500 mb-2">Weekly (last 8)</p>
            <div className="flex flex-wrap gap-2">
              {historyWeekly.map((h, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {h.periodStart}: {h.score} ({h.grade})
                </Badge>
              ))}
              {historyWeekly.length === 0 && <span className="text-neutral-500 text-sm">No history yet</span>}
            </div>
          </div>
          <div>
            <p className="text-xs text-neutral-500 mb-2">Monthly (last 6)</p>
            <div className="flex flex-wrap gap-2">
              {historyMonthly.map((h, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {h.periodStart}: {h.score} ({h.grade})
                </Badge>
              ))}
              {historyMonthly.length === 0 && <span className="text-neutral-500 text-sm">No history yet</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-1" />
          Refresh
        </Button>
        <Link href="/dashboard/forecast">
          <Button variant="outline" size="sm">
            <TrendingUp className="w-4 h-4 mr-1" />
            Forecast
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </div>
      </AsyncState>
    </div>
  );
}
