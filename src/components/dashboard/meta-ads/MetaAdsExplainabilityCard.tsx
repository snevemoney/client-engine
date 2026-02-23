"use client";

import { Info } from "lucide-react";

type Props = {
  mode: string;
  dryRun: boolean;
  targetCpl: number | null;
  minSpend: number;
  minImpressions: number;
  lastGenerated: string | null;
};

export function MetaAdsExplainabilityCard({
  mode,
  dryRun,
  targetCpl,
  minSpend,
  minImpressions,
  lastGenerated,
}: Props) {
  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-900/40 p-3">
      <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
        <Info className="w-3.5 h-3.5" />
        How recommendations are decided
      </h3>
      <ul className="text-xs text-neutral-500 space-y-0.5">
        <li>Mode: <span className="text-neutral-300">{mode}</span></li>
        <li>Dry-run: <span className={dryRun ? "text-amber-400" : "text-neutral-300"}>{dryRun ? "ON (simulated)" : "OFF (real writes)"}</span></li>
        <li>Target CPL: {targetCpl != null ? `$${targetCpl}` : "account avg"}</li>
        <li>Min spend: ${minSpend} · Min impressions: {minImpressions}</li>
        {lastGenerated && (
          <li>Last generated: {new Date(lastGenerated).toLocaleString()}</li>
        )}
        <li className="pt-1 text-neutral-400">Trends compare current selected range vs prior equal period.</li>
        <li className="text-neutral-400">Mark false positives to help tune thresholds over time.</li>
      </ul>
    </div>
  );
}
