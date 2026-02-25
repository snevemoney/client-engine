"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, TrendingUp, ChevronRight } from "lucide-react";
import { gradeToColor } from "@/lib/operator-score/trends";

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
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [historyWeekly, setHistoryWeekly] = useState<{ periodStart: string; score: number; grade: string }[]>([]);
  const [historyMonthly, setHistoryMonthly] = useState<{ periodStart: string; score: number; grade: string }[]>([]);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/operator-score/current").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/operator-score/history?periodType=weekly&limit=8").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/operator-score/history?periodType=monthly&limit=6").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([current, histW, histM]) => {
        setData(current && typeof current === "object" ? current : null);
        setHistoryWeekly(histW?.items ?? []);
        setHistoryMonthly(histM?.items ?? []);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSnapshot = async () => {
    setSnapshotLoading(true);
    try {
      const res = await fetch("/api/operator-score/snapshot", { method: "POST" });
      if (res.ok) fetchData();
      else {
        const d = await res.json();
        alert(d?.error ?? "Snapshot failed");
      }
    } finally {
      setSnapshotLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Operator Score</h1>
        <div className="py-12 text-center text-neutral-500">Loading…</div>
      </div>
    );
  }

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
        <Button size="sm" onClick={handleSnapshot} disabled={snapshotLoading}>
          {snapshotLoading ? "Capturing…" : "Capture Score Snapshot"}
        </Button>
      </div>

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
    </div>
  );
}
