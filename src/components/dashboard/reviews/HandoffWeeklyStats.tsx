"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type HandoffWeeklyStats = {
  handoffsCompletedThisWeek?: number;
  clientConfirmedThisWeek?: number;
  handoffInProgress?: number;
  handoffMissingClientConfirm?: number;
};

export function HandoffWeeklyStats() {
  const [stats, setStats] = useState<HandoffWeeklyStats | null>(null);

  useEffect(() => {
    fetch("/api/delivery-projects/handoff-weekly")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setStats(d && typeof d === "object" ? d : null))
      .catch(() => setStats(null));
  }, []);

  const hasAny =
    (stats?.handoffsCompletedThisWeek ?? 0) > 0 ||
    (stats?.clientConfirmedThisWeek ?? 0) > 0 ||
    (stats?.handoffInProgress ?? 0) > 0 ||
    (stats?.handoffMissingClientConfirm ?? 0) > 0;

  if (!stats || !hasAny) {
    return null;
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Handoff this week</div>
      <div className="flex flex-wrap gap-4 text-sm">
        {(stats.handoffsCompletedThisWeek ?? 0) > 0 && (
          <span className="text-emerald-400"><strong>{stats.handoffsCompletedThisWeek}</strong> handoffs completed</span>
        )}
        {(stats.clientConfirmedThisWeek ?? 0) > 0 && (
          <span className="text-emerald-400"><strong>{stats.clientConfirmedThisWeek}</strong> client confirmed</span>
        )}
        {(stats.handoffInProgress ?? 0) > 0 && (
          <Link href="/dashboard/handoffs?status=handoff_in_progress" className="text-blue-400 hover:underline">
            <strong>{stats.handoffInProgress}</strong> in progress
          </Link>
        )}
        {(stats.handoffMissingClientConfirm ?? 0) > 0 && (
          <Link href="/dashboard/handoffs?status=handoff_missing_client_confirm" className="text-amber-400 hover:underline">
            <strong>{stats.handoffMissingClientConfirm}</strong> missing client confirm
          </Link>
        )}
      </div>
    </div>
  );
}
