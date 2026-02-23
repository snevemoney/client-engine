"use client";

import Link from "next/link";
import { Package } from "lucide-react";
import type { ReusableAssetSummary } from "@/lib/ops/reusableAssetSummary";

export function ReusableAssetSummaryCard({ data }: { data: ReusableAssetSummary }) {
  const { assetsThisWeek, assetsThisMonth, deliveredCount, deliveredWithAssetsCount, pctDeliveredWithAssets, topTypes } = data;

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-2 flex items-center gap-2">
        <Package className="w-4 h-4 text-neutral-500" />
        Reusable assets
      </h2>
      <p className="text-xs text-neutral-500 mb-3">
        Extracted this week/month; % of delivered projects with assets; top types.
      </p>
      <div className="grid gap-2 text-sm">
        <div className="flex justify-between">
          <span className="text-neutral-500">This week</span>
          <span className="font-medium text-neutral-200">{assetsThisWeek}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">This month</span>
          <span className="font-medium text-neutral-200">{assetsThisMonth}</span>
        </div>
        {deliveredCount > 0 && (
          <>
            <div className="flex justify-between">
              <span className="text-neutral-500">Delivered with assets</span>
              <span className="font-medium text-neutral-200">{deliveredWithAssetsCount} / {deliveredCount}</span>
            </div>
            {pctDeliveredWithAssets != null && (
              <div className="flex justify-between">
                <span className="text-neutral-500">% delivered with assets</span>
                <span className="font-medium text-neutral-200">{pctDeliveredWithAssets}%</span>
              </div>
            )}
          </>
        )}
        {topTypes.length > 0 && (
          <div className="pt-2 border-t border-neutral-800">
            <p className="text-xs text-neutral-500 mb-1">Top types</p>
            <p className="text-xs text-neutral-400">
              {topTypes.map((t) => `${t.assetType.replace(/_/g, " ")} (${t.count})`).join(" · ")}
            </p>
          </div>
        )}
      </div>
      <Link href="/dashboard/results" className="text-xs text-neutral-400 hover:underline mt-2 inline-block">
        Results Ledger →
      </Link>
    </section>
  );
}
