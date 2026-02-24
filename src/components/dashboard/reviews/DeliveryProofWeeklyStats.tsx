"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Summary = {
  createdThisWeek?: number;
  readyThisWeek?: number;
  promotedThisWeek?: number;
  pendingDrafts?: number;
  pendingReady?: number;
} | null;

export function DeliveryProofWeeklyStats() {
  const [summary, setSummary] = useState<Summary>(null);

  useEffect(() => {
    fetch("/api/proof-candidates/summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSummary(d && typeof d === "object" ? d : null))
      .catch(() => setSummary(null));
  }, []);

  const hasAny =
    (summary?.createdThisWeek ?? 0) > 0 ||
    (summary?.promotedThisWeek ?? 0) > 0 ||
    (summary?.pendingDrafts ?? 0) > 0 ||
    (summary?.pendingReady ?? 0) > 0;
  if (!summary || !hasAny) {
    return null;
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Delivery proof this week</div>
      <div className="flex flex-wrap gap-4 text-sm">
        {(summary?.createdThisWeek ?? 0) > 0 && (
          <span><strong>{summary?.createdThisWeek}</strong> candidates created</span>
        )}
        {(summary?.promotedThisWeek ?? 0) > 0 && (
          <Link href="/dashboard/proof" className="text-emerald-400 hover:underline">
            <strong>{summary?.promotedThisWeek}</strong> promoted
          </Link>
        )}
        {((summary?.pendingReady ?? 0) > 0 || (summary?.pendingDrafts ?? 0) > 0) && (
          <Link href="/dashboard/proof-candidates" className="text-amber-400 hover:underline">
            <strong>{(summary?.pendingReady ?? 0) + (summary?.pendingDrafts ?? 0)}</strong> pending
          </Link>
        )}
      </div>
    </div>
  );
}
