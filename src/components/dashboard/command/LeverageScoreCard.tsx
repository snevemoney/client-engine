import { Gauge } from "lucide-react";
import type { LeverageScoreResult } from "@/lib/ops/leverageScore";

export function LeverageScoreCard({ data }: { data: LeverageScoreResult }) {
  const { score, components } = data;
  const trendHint =
    score >= 60 ? "Operator system" : score >= 30 ? "Build leverage" : "Log assets & outcomes";

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-neutral-300 flex items-center gap-2">
          <Gauge className="w-4 h-4 text-neutral-500" />
          Leverage Score
        </h2>
        <span
          className={`text-2xl font-semibold tabular-nums ${
            score >= 60 ? "text-emerald-400" : score >= 30 ? "text-amber-400" : "text-neutral-500"
          }`}
        >
          {score}
        </span>
      </div>
      <p className="text-xs text-neutral-500 mb-3">
        {trendHint}. Review weekly with the production checklist.
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-neutral-400">
        <span>Reusable assets</span>
        <span className="tabular-nums text-right">{components.reusableAssetPct}%</span>
        <span>Outcomes tracked</span>
        <span className="tabular-nums text-right">{components.outcomesTrackedPct}%</span>
        <span>Learning → action</span>
        <span className="tabular-nums text-right">{components.learningActionPct}%</span>
        <span>Failure visibility</span>
        <span className="tabular-nums text-right">{components.failureVisibilityScore}</span>
        <span>Proposal win rate</span>
        <span className="tabular-nums text-right">
          {components.proposalWinRatePct != null ? `${components.proposalWinRatePct}%` : "—"}
        </span>
      </div>
      <p className="text-xs text-neutral-500 mt-2">
        See <strong>docs/WEEKLY_PRODUCTION_CRITICISM_CHECKLIST.md</strong> for the weekly ritual.
      </p>
    </section>
  );
}
