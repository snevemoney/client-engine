"use client";

import { Lightbulb, AlertTriangle } from "lucide-react";
import type { OperatorInsight } from "@/lib/meta-ads/types";
import { META_ADS_NEEDS_ATTENTION_LIMIT } from "@/lib/meta-ads/constants";

export function MetaAdsInsightsPanel({ insights }: { insights: OperatorInsight[] }) {
  const needsAttention = insights
    .filter((i) => i.severity === "warn" || i.severity === "critical")
    .slice(0, META_ADS_NEEDS_ATTENTION_LIMIT);
  const rest = insights.filter((i) => i.severity === "info");

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 sticky top-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-amber-400" />
        Operator Insights
      </h2>
      <p className="text-xs text-neutral-500 mb-3">
        Rule-based suggestions. Review and act in Ads Manager.
      </p>

      {needsAttention.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-medium text-amber-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            Needs attention (top {needsAttention.length})
          </h3>
          <div className="space-y-2">
            {needsAttention.map((i, idx) => (
              <div
                key={`${i.entityType}-${i.entityId}-${idx}`}
                className={`rounded border p-2 text-xs ${
                  i.severity === "critical"
                    ? "border-red-800/50 bg-red-950/20"
                    : "border-amber-800/50 bg-amber-950/20"
                }`}
              >
                <p className="text-neutral-200 font-medium truncate" title={i.entityName}>
                  {i.entityName}
                </p>
                <p className="text-neutral-400 mt-0.5">{i.message}</p>
                <p className="text-neutral-500 mt-1 italic">→ {i.suggestedAction}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {rest.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
            Other insights
          </h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {rest.map((i, idx) => (
              <div
                key={`${i.entityType}-${i.entityId}-${idx}`}
                className="rounded border border-neutral-700 bg-neutral-800/50 p-2 text-xs"
              >
                <p className="text-neutral-200 font-medium truncate" title={i.entityName}>
                  {i.entityName}
                </p>
                <p className="text-neutral-400 mt-0.5">{i.message}</p>
                <p className="text-neutral-500 mt-1 italic">→ {i.suggestedAction}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {insights.length === 0 && (
        <p className="text-neutral-500 text-sm">No insights for this period.</p>
      )}
    </section>
  );
}
