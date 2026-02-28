"use client";

/**
 * Phase 4: Lightweight intelligence banner for operational pages.
 * Shows risk flags, NBA queue count, and health score at a glance.
 */

import Link from "next/link";
import type { IntelligenceContext } from "@/hooks/useIntelligenceContext";

interface IntelligenceBannerProps {
  risk: IntelligenceContext["risk"] | null;
  nba: IntelligenceContext["nba"] | null;
  score: IntelligenceContext["score"] | null;
  loading?: boolean;
}

function BandDot({ band }: { band: string }) {
  const color =
    band === "critical"
      ? "bg-red-500"
      : band === "warning"
        ? "bg-yellow-500"
        : "bg-green-500";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

export function IntelligenceBanner({ risk, nba, score, loading }: IntelligenceBannerProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-4 rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-2 text-xs text-neutral-500 animate-pulse">
        Loading intelligence...
      </div>
    );
  }

  const hasRisk = risk && risk.openCount > 0;
  const hasNba = nba && nba.queuedCount > 0;
  const hasScore = score != null;

  if (!hasRisk && !hasNba && !hasScore) return null;

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-2 text-xs">
      {hasScore && (
        <Link href="/dashboard/internal/scoreboard" className="flex items-center gap-1.5 text-neutral-400 hover:text-neutral-200 transition-colors">
          <BandDot band={score.band} />
          <span>Health {Math.round(score.value)}</span>
          {score.delta !== 0 && (
            <span className={score.delta > 0 ? "text-green-400" : "text-red-400"}>
              {score.delta > 0 ? "+" : ""}{score.delta.toFixed(1)}
            </span>
          )}
        </Link>
      )}

      {hasRisk && (
        <Link href="/dashboard/risk" className="flex items-center gap-1.5 text-neutral-400 hover:text-neutral-200 transition-colors">
          <span className={risk.criticalCount > 0 ? "text-red-400" : risk.highCount > 0 ? "text-yellow-400" : "text-neutral-400"}>
            {risk.openCount} risk{risk.openCount !== 1 ? "s" : ""}
          </span>
          {risk.criticalCount > 0 && (
            <span className="text-red-400">({risk.criticalCount} critical)</span>
          )}
        </Link>
      )}

      {hasNba && (
        <Link href="/dashboard/next-actions" className="flex items-center gap-1.5 text-neutral-400 hover:text-neutral-200 transition-colors">
          <span>{nba.queuedCount} action{nba.queuedCount !== 1 ? "s" : ""} queued</span>
          {nba.criticalCount > 0 && (
            <span className="text-red-400">({nba.criticalCount} critical)</span>
          )}
        </Link>
      )}
    </div>
  );
}
