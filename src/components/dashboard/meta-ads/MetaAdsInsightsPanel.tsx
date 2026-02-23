"use client";

import { Lightbulb } from "lucide-react";
import type { OperatorInsight } from "@/lib/meta-ads/types";

export function MetaAdsInsightsPanel({ insights }: { insights: OperatorInsight[] }) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 sticky top-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-amber-400" />
        Operator Insights
      </h2>
      <p className="text-xs text-neutral-500 mb-3">
        Rule-based suggestions. Review and act in Ads Manager.
      </p>
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {insights.length === 0 ? (
          <p className="text-neutral-500 text-sm">No insights for this period.</p>
        ) : (
          insights.map((i, idx) => (
            <div
              key={`${i.entityType}-${i.entityId}-${idx}`}
              className={`rounded border p-2 text-xs ${
                i.severity === "critical"
                  ? "border-red-800/50 bg-red-950/20"
                  : i.severity === "warn"
                    ? "border-amber-800/50 bg-amber-950/20"
                    : "border-neutral-700 bg-neutral-800/50"
              }`}
            >
              <p className="text-neutral-200 font-medium truncate" title={i.entityName}>
                {i.entityName}
              </p>
              <p className="text-neutral-400 mt-0.5">{i.message}</p>
              <p className="text-neutral-500 mt-1 italic">→ {i.suggestedAction}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
