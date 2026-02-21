"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Target, BarChart3, Wrench, TrendingUp, Package } from "lucide-react";

type GlanceData = {
  resultTarget: { currentState: string; targetState: string; metric: string; timeline: string } | null;
  baseline: { metrics: unknown[] } | null;
  interventions: unknown[];
  outcomeEntries: unknown[];
  reusableAssets: unknown[];
};

export function ClientResultsGlance({ leadId }: { leadId: string }) {
  const [data, setData] = useState<GlanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/leads/${leadId}/client-success`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setData(d ?? null);
      })
      .finally(() => setLoading(false));
  }, [leadId]);

  if (loading || !data) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 text-sm text-neutral-500">
        Loading results…
      </div>
    );
  }

  const hasAny =
    data.resultTarget ||
    (data.baseline && data.baseline.metrics?.length > 0) ||
    data.interventions?.length > 0 ||
    data.outcomeEntries?.length > 0 ||
    data.reusableAssets?.length > 0;

  if (!hasAny) {
    return (
      <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3">
        <h3 className="text-xs font-medium text-emerald-300/90 uppercase tracking-wider mb-1 flex items-center gap-1">
          <Target className="w-3.5 h-3.5" /> Results at a glance
        </h3>
        <p className="text-xs text-neutral-400">No outcome data yet. Use the Client Success card below to set result target, baseline, and log interventions.</p>
        <a href="#client-success" className="text-xs text-emerald-400 hover:underline mt-1 inline-block">Open Client Success →</a>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3">
      <h3 className="text-xs font-medium text-emerald-300/90 uppercase tracking-wider mb-2 flex items-center gap-1">
        <Target className="w-3.5 h-3.5" /> Results at a glance
      </h3>
      <div className="grid gap-1.5 text-sm text-neutral-300">
        {data.resultTarget && (
          <div className="flex items-start gap-2">
            <Target className="w-3.5 h-3.5 text-emerald-500/80 flex-shrink-0 mt-0.5" />
            <span>
              {data.resultTarget.currentState} → {data.resultTarget.targetState} ({data.resultTarget.metric}, {data.resultTarget.timeline})
            </span>
          </div>
        )}
        {data.baseline && data.baseline.metrics?.length > 0 && (
          <div className="flex items-center gap-2 text-neutral-400">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Baseline captured ({data.baseline.metrics.length} metrics)</span>
          </div>
        )}
        {data.interventions?.length > 0 && (
          <div className="flex items-center gap-2 text-neutral-400">
            <Wrench className="w-3.5 h-3.5" />
            <span>{data.interventions.length} intervention(s)</span>
          </div>
        )}
        {data.outcomeEntries?.length > 0 && (
          <div className="flex items-center gap-2 text-neutral-400">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{data.outcomeEntries.length} outcome entry(ies)</span>
          </div>
        )}
        {data.reusableAssets?.length > 0 && (
          <div className="flex items-center gap-2 text-neutral-400">
            <Package className="w-3.5 h-3.5" />
            <span>{data.reusableAssets.length} reusable asset(s) extracted</span>
          </div>
        )}
      </div>
      <Link href="#client-success" className="text-xs text-emerald-400 hover:underline mt-2 inline-block">
        Full Client Success →
      </Link>
    </div>
  );
}
