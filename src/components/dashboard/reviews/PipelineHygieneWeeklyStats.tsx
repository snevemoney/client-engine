"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Summary = {
  unscoredCount?: number;
  readyToPromoteCount?: number;
  promotedMissingNextActionCount?: number;
  sentFollowupOverdueCount?: number;
  wonMissingProofCount?: number;
} | null;

export function PipelineHygieneWeeklyStats() {
  const [summary, setSummary] = useState<Summary>(null);

  useEffect(() => {
    fetch("/api/intake-leads/action-summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSummary(d && typeof d === "object" ? d : null))
      .catch(() => setSummary(null));
  }, []);

  const hasAny =
    (summary?.unscoredCount ?? 0) > 0 ||
    (summary?.readyToPromoteCount ?? 0) > 0 ||
    (summary?.promotedMissingNextActionCount ?? 0) > 0 ||
    (summary?.sentFollowupOverdueCount ?? 0) > 0 ||
    (summary?.wonMissingProofCount ?? 0) > 0;
  if (!summary || !hasAny) {
    return null;
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Pipeline hygiene</div>
      <div className="flex flex-wrap gap-4 text-sm">
        {(summary?.unscoredCount ?? 0) > 0 && (
          <Link href="/dashboard/intake?filter=needs-score" className="text-amber-400 hover:underline">
            <strong>{summary?.unscoredCount}</strong> need score
          </Link>
        )}
        {(summary?.readyToPromoteCount ?? 0) > 0 && (
          <Link href="/dashboard/intake?filter=ready" className="text-emerald-400 hover:underline">
            <strong>{summary?.readyToPromoteCount}</strong> ready to promote
          </Link>
        )}
        {(summary?.sentFollowupOverdueCount ?? 0) > 0 && (
          <Link href="/dashboard/intake?filter=followup-overdue" className="text-red-400 hover:underline">
            <strong>{summary?.sentFollowupOverdueCount}</strong> follow-up overdue
          </Link>
        )}
        {(summary?.wonMissingProofCount ?? 0) > 0 && (
          <Link href="/dashboard/intake?filter=won-missing-proof" className="text-amber-400 hover:underline">
            <strong>{summary?.wonMissingProofCount}</strong> won missing proof
          </Link>
        )}
      </div>
    </div>
  );
}
