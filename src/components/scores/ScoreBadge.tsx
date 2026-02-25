/**
 * Phase 3.2: Band badge (healthy / warning / critical).
 */
import type { ScoreBand } from "@/lib/scoring/types";

const BAND_STYLES: Record<ScoreBand, string> = {
  healthy: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
  warning: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  critical: "bg-red-500/20 text-red-400 border-red-500/40",
};

export function ScoreBadge({ band }: { band: string }) {
  const cls = BAND_STYLES[band as ScoreBand] ?? "bg-neutral-500/20 text-neutral-400 border-neutral-500/40";
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${cls}`}
      data-testid="score-badge"
    >
      {band}
    </span>
  );
}
