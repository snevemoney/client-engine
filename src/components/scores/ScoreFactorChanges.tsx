/**
 * Phase 3.3: Factor change drilldown — latest vs previous (What changed?).
 */
import type { FactorChange } from "@/lib/scores/trend-utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type Props = {
  changes: FactorChange[];
};

export function ScoreFactorChanges({ changes }: Props) {
  if (changes.length === 0) {
    return (
      <div
        className="rounded-lg border border-dashed border-neutral-700 bg-neutral-900/30 p-6 text-center text-sm text-neutral-500"
        data-testid="score-factor-changes-empty"
      >
        No previous snapshot to compare
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 overflow-x-auto"
      data-testid="score-factor-changes"
    >
      <h2 className="text-sm font-medium text-neutral-300 mb-3">What changed?</h2>
      <p className="text-xs text-neutral-500 mb-3">
        Factors sorted by largest negative impact change first.
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-neutral-500">
            <th className="pb-2 pr-4">Factor</th>
            <th className="pb-2 pr-4">Prev</th>
            <th className="pb-2 pr-4">Current</th>
            <th className="pb-2 pr-4">Δ</th>
            <th className="pb-2">Impact Δ</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((c) => (
            <tr key={c.key} className="border-t border-neutral-800">
              <td className="py-1.5 pr-4">{c.label}</td>
              <td className="py-1.5 pr-4">{c.prevValue.toFixed(0)}</td>
              <td className="py-1.5 pr-4">{c.currValue.toFixed(0)}</td>
              <td className="py-1.5 pr-4">
                <span
                  className={
                    c.delta > 0 ? "text-emerald-400" : c.delta < 0 ? "text-red-400" : "text-neutral-500"
                  }
                >
                  {c.delta > 0 ? "+" : ""}
                  {c.delta.toFixed(0)}
                </span>
              </td>
              <td className="py-1.5">
                <span
                  className={
                    c.impact > 0 ? "text-emerald-400" : c.impact < 0 ? "text-red-400" : "text-neutral-500"
                  }
                >
                  {c.direction === "up" && <TrendingUp className="inline w-3 h-3 mr-0.5" />}
                  {c.direction === "down" && <TrendingDown className="inline w-3 h-3 mr-0.5" />}
                  {c.direction === "flat" && <Minus className="inline w-3 h-3 mr-0.5" />}
                  {c.impact >= 0 ? "+" : ""}
                  {c.impact.toFixed(1)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
