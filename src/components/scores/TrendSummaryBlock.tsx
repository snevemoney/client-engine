/**
 * Phase 3.3: Trend summary — current, net change, min/max, event counts.
 */
import type { TrendSummary } from "@/lib/scores/trend-utils";

type Props = {
  summary: TrendSummary;
  rangeLabel: string;
};

export function TrendSummaryBlock({ summary, rangeLabel }: Props) {
  const { currentScore, netChange, highest, lowest, eventCounts } = summary;
  const hasEvents =
    eventCounts.threshold_breach > 0 || eventCounts.sharp_drop > 0 || eventCounts.recovery > 0;

  return (
    <div
      className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4"
      data-testid="trend-summary-block"
    >
      <h2 className="text-sm font-medium text-neutral-300 mb-3">Trend summary ({rangeLabel})</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-neutral-500 block">Current</span>
          <span className="font-medium">{Math.round(currentScore)}</span>
        </div>
        <div>
          <span className="text-neutral-500 block">Net change</span>
          <span
            className={
              netChange >= 0 ? "text-emerald-400 font-medium" : "text-red-400 font-medium"
            }
          >
            {netChange >= 0 ? "+" : ""}
            {netChange.toFixed(1)}
          </span>
        </div>
        <div>
          <span className="text-neutral-500 block">Range</span>
          <span className="font-medium">
            {Math.round(lowest)} – {Math.round(highest)}
          </span>
        </div>
        <div>
          <span className="text-neutral-500 block">Events</span>
          <span className="font-medium" title="breach / drop / recovery">
            {hasEvents ? (
              <>
                <span className="text-amber-400">{eventCounts.threshold_breach} breach</span>
                {" · "}
                <span className="text-red-400">{eventCounts.sharp_drop} drop</span>
                {" · "}
                <span className="text-emerald-400">{eventCounts.recovery} recovery</span>
              </>
            ) : (
              <span className="text-neutral-500">0</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
