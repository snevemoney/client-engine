"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Summary = {
  wonLeadsWithoutProofCandidate?: number;
  readyCandidatesPendingPromotion?: number;
  proofRecordsMissingFields?: number;
  promotedThisWeek?: number;
} | null;

export function ProofGapWeeklyStats() {
  const [summary, setSummary] = useState<Summary>(null);

  useEffect(() => {
    fetch("/api/proof-gaps/summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSummary(d && typeof d === "object" ? d : null))
      .catch(() => setSummary(null));
  }, []);

  const hasAny =
    (summary?.wonLeadsWithoutProofCandidate ?? 0) > 0 ||
    (summary?.readyCandidatesPendingPromotion ?? 0) > 0 ||
    (summary?.proofRecordsMissingFields ?? 0) > 0 ||
    (summary?.promotedThisWeek ?? 0) > 0;
  if (!summary || !hasAny) {
    return null;
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Proof gaps</div>
      <div className="flex flex-wrap gap-4 text-sm">
        {(summary?.wonLeadsWithoutProofCandidate ?? 0) > 0 && (
          <Link href="/dashboard/intake?filter=won-missing-proof" className="text-amber-400 hover:underline">
            <strong>{summary?.wonLeadsWithoutProofCandidate}</strong> won without proof
          </Link>
        )}
        {(summary?.readyCandidatesPendingPromotion ?? 0) > 0 && (
          <Link href="/dashboard/proof-candidates" className="text-emerald-400 hover:underline">
            <strong>{summary?.readyCandidatesPendingPromotion}</strong> ready to promote
          </Link>
        )}
        {(summary?.proofRecordsMissingFields ?? 0) > 0 && (
          <Link href="/dashboard/proof" className="text-red-400 hover:underline">
            <strong>{summary?.proofRecordsMissingFields}</strong> incomplete records
          </Link>
        )}
        {(summary?.promotedThisWeek ?? 0) > 0 && (
          <span className="text-emerald-400">
            <strong>{summary?.promotedThisWeek}</strong> promoted this week
          </span>
        )}
      </div>
    </div>
  );
}
