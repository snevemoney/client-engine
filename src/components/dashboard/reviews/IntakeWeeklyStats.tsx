"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Summary = {
  sentThisWeek?: number;
  wonThisWeek?: number;
  proofCreatedThisWeek?: number;
};

export function IntakeWeeklyStats() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    fetch("/api/intake-leads/summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSummary(d && typeof d === "object" ? d : null))
      .catch(() => setSummary(null));
  }, []);

  if (!summary || (summary.sentThisWeek ?? 0) === 0 && (summary.wonThisWeek ?? 0) === 0 && (summary.proofCreatedThisWeek ?? 0) === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Intake this week</div>
      <div className="flex flex-wrap gap-4 text-sm">
        {(summary.sentThisWeek ?? 0) > 0 && (
          <span><strong>{summary.sentThisWeek}</strong> sent</span>
        )}
        {(summary.wonThisWeek ?? 0) > 0 && (
          <span className="text-emerald-400"><strong>{summary.wonThisWeek}</strong> won</span>
        )}
        {(summary.proofCreatedThisWeek ?? 0) > 0 && (
          <Link href="/dashboard/proof" className="text-amber-400 hover:underline">
            <strong>{summary.proofCreatedThisWeek}</strong> proof records
          </Link>
        )}
      </div>
    </div>
  );
}
