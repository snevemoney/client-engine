"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type RevenueIntelligenceStats = {
  proposalSentToAcceptedRate?: number;
  acceptedToDeliveryStartedRate?: number;
  deliveryCompletedToProofRate?: number;
  deliveredValueThisWeek?: number;
  avgSentToAcceptedDays?: number;
  topSourceByWins?: string | null;
  topBottleneck?: string | null;
  bottleneckCount?: number;
};

export function RevenueIntelligenceWeeklyStats() {
  const [stats, setStats] = useState<RevenueIntelligenceStats | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/metrics/summary").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([summary]) => {
        if (summary && typeof summary === "object") {
          const topBottleneck = summary.bottlenecks?.[0];
          setStats({
            proposalSentToAcceptedRate: summary.conversion?.proposalSentToAcceptedRate ?? 0,
            acceptedToDeliveryStartedRate: summary.conversion?.acceptedToDeliveryStartedRate ?? 0,
            deliveryCompletedToProofRate: summary.conversion?.deliveryCompletedToProofRate ?? 0,
            deliveredValueThisWeek: summary.revenue?.deliveredValueThisWeek ?? 0,
            avgSentToAcceptedDays: summary.cycleTimes?.proposalSentToAcceptedAvgDays ?? 0,
            topSourceByWins: summary.sourcePerformance?.topSourceByWins ?? null,
            topBottleneck: topBottleneck?.label ?? null,
            bottleneckCount: topBottleneck?.count ?? 0,
          });
        } else {
          setStats(null);
        }
      })
      .catch(() => setStats(null));
  }, []);

  const hasAny =
    (stats?.proposalSentToAcceptedRate ?? 0) > 0 ||
    (stats?.acceptedToDeliveryStartedRate ?? 0) > 0 ||
    (stats?.deliveryCompletedToProofRate ?? 0) > 0 ||
    (stats?.deliveredValueThisWeek ?? 0) > 0 ||
    (stats?.avgSentToAcceptedDays ?? 0) > 0 ||
    (stats?.topSourceByWins ?? "") !== "" ||
    (stats?.topBottleneck ?? "") !== "" ||
    (stats?.bottleneckCount ?? 0) > 0;

  if (!stats || !hasAny) {
    return null;
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Revenue Intelligence</div>
      <div className="flex flex-wrap gap-4 text-sm">
        {(stats.proposalSentToAcceptedRate ?? 0) > 0 && (
          <span>Sent→Accepted: <strong>{(stats.proposalSentToAcceptedRate! * 100).toFixed(1)}%</strong></span>
        )}
        {(stats.acceptedToDeliveryStartedRate ?? 0) > 0 && (
          <span>Accepted→Delivery: <strong>{(stats.acceptedToDeliveryStartedRate! * 100).toFixed(1)}%</strong></span>
        )}
        {(stats.deliveryCompletedToProofRate ?? 0) > 0 && (
          <span>Delivery→Proof: <strong>{(stats.deliveryCompletedToProofRate! * 100).toFixed(1)}%</strong></span>
        )}
        {(stats.deliveredValueThisWeek ?? 0) > 0 && (
          <Link href="/dashboard/intelligence" className="text-emerald-400 hover:underline">
            <strong>${stats.deliveredValueThisWeek!.toLocaleString("en-US")}</strong> delivered (wk)
          </Link>
        )}
        {(stats.avgSentToAcceptedDays ?? 0) > 0 && (
          <span>Avg sent→accepted: <strong>{stats.avgSentToAcceptedDays!.toFixed(1)}</strong> days</span>
        )}
        {stats.topSourceByWins && (
          <span>Top source (wins): <strong>{stats.topSourceByWins}</strong></span>
        )}
        {stats.topBottleneck && (
          <Link href="/dashboard/intelligence" className="text-amber-400 hover:underline">
            Top bottleneck: <strong>{stats.topBottleneck}</strong> ({stats.bottleneckCount ?? 0})
          </Link>
        )}
      </div>
    </div>
  );
}
