"use client";

import { Info, Calendar } from "lucide-react";

type EmptyStateProps = {
  accountId: string;
  range: string;
};

export function MetaAdsEmptyState({ accountId, range }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-6">
      <div className="flex gap-3">
        <Info className="w-5 h-5 text-neutral-500 shrink-0 mt-0.5" />
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-neutral-200">No campaigns in selected range</h3>
          <p className="text-sm text-neutral-400">
            Meta connection is working. No campaigns delivered spend in the selected date range.
          </p>
          <ul className="text-xs text-neutral-500 space-y-0.5 list-disc list-inside">
            <li>Selected: {range}. Try <strong>30d</strong> or another range — campaigns may be paused or have no recent delivery</li>
            <li>Account: <code className="rounded bg-neutral-800 px-1 py-0.5 font-mono text-neutral-400">{accountId}</code></li>
          </ul>
          <p className="text-xs text-neutral-500 pt-1">
            <Calendar className="w-3.5 h-3.5 inline mr-1 align-middle" />
            Data reflects Meta&apos;s attribution for the chosen period.
          </p>
        </div>
      </div>
    </div>
  );
}
