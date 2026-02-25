/**
 * Phase 3.2: Current score card (score, band, delta, timestamp).
 */
import { ScoreBadge } from "./ScoreBadge";

type Props = {
  score: number;
  band: string;
  delta: number | null;
  computedAt: string;
};

export function ScoreCard({ score, band, delta, computedAt }: Props) {
  return (
    <div
      className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4"
      data-testid="score-card"
    >
      <h2 className="text-sm font-medium text-neutral-300 mb-3">Current score</h2>
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <span className="text-3xl font-bold">{Math.round(score)}</span>
          <span className="text-neutral-500 ml-2">/ 100</span>
        </div>
        <ScoreBadge band={band} />
        {delta != null && (
          <span
            className={delta >= 0 ? "text-emerald-400" : "text-red-400"}
            data-testid="score-delta"
          >
            Δ {delta >= 0 ? "+" : ""}{delta.toFixed(1)}
          </span>
        )}
        <span className="text-xs text-neutral-500">
          {new Date(computedAt).toLocaleString()}
        </span>
      </div>
    </div>
  );
}
