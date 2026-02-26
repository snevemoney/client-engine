"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type OperatorForecastStats = {
  weeklyScore?: number | null;
  weeklyGrade?: string | null;
  topRisk?: string | null;
  topWin?: string | null;
  projectedDeliveredValueMonth?: number | null;
  behindPaceCount?: number;
  confidenceSummary?: string | null;
};

export function OperatorForecastWeeklyStats() {
  const [stats, setStats] = useState<OperatorForecastStats | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/operator-score/current").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/forecast/current").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([opScore, forecast]) => {
        if (opScore && typeof opScore === "object") {
          const weekly = opScore.weekly;
          const deliveredMetric = forecast?.monthly?.metrics?.find((m: { key: string }) => m.key === "delivered_value");
          const allMetrics = [
            ...(forecast?.weekly?.metrics ?? []),
            ...(forecast?.monthly?.metrics ?? []),
          ];
          const high = allMetrics.filter((m: { confidence?: string }) => m.confidence === "high").length;
          const medium = allMetrics.filter((m: { confidence?: string }) => m.confidence === "medium").length;
          const low = allMetrics.filter((m: { confidence?: string }) => m.confidence === "low").length;
          const parts: string[] = [];
          if (high > 0) parts.push(`${high} high`);
          if (medium > 0) parts.push(`${medium} medium`);
          if (low > 0) parts.push(`${low} low`);
          setStats({
            weeklyScore: weekly?.score ?? null,
            weeklyGrade: weekly?.grade ?? null,
            topRisk: weekly?.topRisks?.[0] ?? null,
            topWin: weekly?.topWins?.[0] ?? null,
            projectedDeliveredValueMonth: deliveredMetric?.projected ?? null,
            behindPaceCount: forecast?.behindPaceCount ?? 0,
            confidenceSummary: parts.length > 0 ? parts.join(" / ") : null,
          });
        } else {
          setStats(null);
        }
      })
      .catch(() => setStats(null));
  }, []);

  const hasAny =
    (stats?.weeklyScore ?? 0) > 0 ||
    (stats?.weeklyGrade ?? "") !== "" ||
    (stats?.topRisk ?? "") !== "" ||
    (stats?.topWin ?? "") !== "" ||
    (stats?.projectedDeliveredValueMonth ?? 0) > 0 ||
    (stats?.behindPaceCount ?? 0) > 0 ||
    (stats?.confidenceSummary ?? "") !== "";

  if (!stats || !hasAny) {
    return null;
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Operator + Forecast</div>
      <div className="flex flex-wrap gap-4 text-sm">
        {(stats.weeklyScore ?? 0) > 0 && (
          <span>Weekly score: <strong>{stats.weeklyScore}</strong> ({stats.weeklyGrade ?? "—"})</span>
        )}
        {stats.topRisk && (
          <span className="text-amber-400">Top risk: <strong>{stats.topRisk}</strong></span>
        )}
        {stats.topWin && (
          <span className="text-emerald-400">Top win: <strong>{stats.topWin}</strong></span>
        )}
        {(stats.projectedDeliveredValueMonth ?? 0) > 0 && (
          <Link href="/dashboard/forecast" className="text-emerald-400 hover:underline">
            Projected delivered (mo): <strong>${stats.projectedDeliveredValueMonth!.toLocaleString("en-US")}</strong>
          </Link>
        )}
        {(stats.behindPaceCount ?? 0) > 0 && (
          <span className="text-amber-400">Behind pace: <strong>{stats.behindPaceCount}</strong></span>
        )}
        {stats.confidenceSummary && (
          <span>Confidence: <strong>{stats.confidenceSummary}</strong></span>
        )}
      </div>
      <div className="flex gap-2 mt-2">
        <Link href="/dashboard/operator" className="text-xs text-amber-400 hover:underline">
          Operator Score
        </Link>
        <Link href="/dashboard/forecast" className="text-xs text-amber-400 hover:underline">
          Forecast
        </Link>
      </div>
    </div>
  );
}
