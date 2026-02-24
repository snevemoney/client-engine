"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type DeliveryWeeklyStats = {
  completedThisWeek?: number;
  overdue?: number;
  proofRequestedPending?: number;
  proofCandidatesCreatedThisWeek?: number;
};

export function DeliveryWeeklyStats() {
  const [stats, setStats] = useState<DeliveryWeeklyStats | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/delivery-projects/summary").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([sum]) => {
        setStats({
          completedThisWeek: sum?.completedThisWeek ?? 0,
          overdue: sum?.overdue ?? 0,
          proofRequestedPending: sum?.proofRequestedPending ?? 0,
          proofCandidatesCreatedThisWeek: 0,
        });
      })
      .catch(() => setStats(null));
  }, []);

  const hasAny =
    (stats?.completedThisWeek ?? 0) > 0 ||
    (stats?.overdue ?? 0) > 0 ||
    (stats?.proofRequestedPending ?? 0) > 0 ||
    (stats?.proofCandidatesCreatedThisWeek ?? 0) > 0;

  if (!stats || !hasAny) {
    return null;
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Delivery this week</div>
      <div className="flex flex-wrap gap-4 text-sm">
        {(stats.completedThisWeek ?? 0) > 0 && (
          <Link href="/dashboard/delivery" className="text-emerald-400 hover:underline">
            <strong>{stats.completedThisWeek}</strong> completed
          </Link>
        )}
        {(stats.overdue ?? 0) > 0 && (
          <Link href="/dashboard/delivery?due=overdue" className="text-red-400 hover:underline">
            <strong>{stats.overdue}</strong> overdue
          </Link>
        )}
        {(stats.proofRequestedPending ?? 0) > 0 && (
          <span className="text-amber-400"><strong>{stats.proofRequestedPending}</strong> proof requested, pending</span>
        )}
        {(stats.proofCandidatesCreatedThisWeek ?? 0) > 0 && (
          <Link href="/dashboard/proof-candidates" className="text-amber-400 hover:underline">
            <strong>{stats.proofCandidatesCreatedThisWeek}</strong> proof candidates from delivery
          </Link>
        )}
      </div>
    </div>
  );
}
