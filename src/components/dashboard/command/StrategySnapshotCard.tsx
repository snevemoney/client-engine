"use client";

import Link from "next/link";
import type { StrategyWeekSummary } from "@/lib/ops/strategyWeek";

export function StrategySnapshotCard({ data }: { data: StrategyWeekSummary | null }) {
  if (!data) {
    return (
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium text-neutral-300">Strategy Quadrant</h2>
          <Link
            href="/dashboard/strategy"
            className="text-xs text-amber-300 hover:underline"
          >
            Set up →
          </Link>
        </div>
        <p className="text-xs text-neutral-500">No weekly strategy set yet.</p>
      </section>
    );
  }

  const weekLabel = new Date(data.weekStart).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-neutral-300">Strategy Quadrant</h2>
        <Link
          href="/dashboard/strategy"
          className="text-xs text-amber-300 hover:underline"
        >
          Edit →
        </Link>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex gap-2">
          <span className="text-neutral-500">Week:</span>
          <span className="text-neutral-300">{weekLabel}</span>
        </div>
        {data.phase && (
          <div className="flex gap-2">
            <span className="text-neutral-500">Phase:</span>
            <span className="text-neutral-300 capitalize">{data.phase}</span>
          </div>
        )}
        {data.activeCampaignName && (
          <div className="flex gap-2">
            <span className="text-neutral-500">Campaign:</span>
            <span className="text-neutral-300 truncate">{data.activeCampaignName}</span>
          </div>
        )}
        {data.salesTarget && (
          <div className="flex gap-2">
            <span className="text-neutral-500">Sales target:</span>
            <span className="text-neutral-300 truncate">{data.salesTarget}</span>
          </div>
        )}
        <div className="flex gap-2">
          <span className="text-neutral-500">Review:</span>
          <span className="text-neutral-300">{data.reviewChecks}/4</span>
        </div>
      </div>
    </section>
  );
}
