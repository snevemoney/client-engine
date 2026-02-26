"use client";

import type { MetaAdsAdSet } from "@/lib/meta-ads/types";
import { META_ADS_INSIGHTS } from "@/lib/meta-ads/constants";
import { MetaAdsStatusActions } from "./MetaAdsStatusActions";

function fmt(v: number, isMoney = false): string {
  return isMoney ? `$${v.toFixed(2)}` : v.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

function RowBadges({ adset, avgCpl }: { adset: MetaAdsAdSet; avgCpl: number | null }) {
  const badges: string[] = [];
  if (adset.spend >= META_ADS_INSIGHTS.MIN_SPEND_NO_LEADS && adset.leads === 0 && adset.effectiveStatus === "ACTIVE") badges.push("No leads");
  if (adset.frequency != null && adset.frequency > META_ADS_INSIGHTS.FREQUENCY_FATIGUE_THRESHOLD) badges.push("Fatigue");
  if (avgCpl != null && adset.leads >= 1) {
    const cpl = adset.costPerLead ?? (adset.spend / adset.leads);
    if (cpl > avgCpl * META_ADS_INSIGHTS.CPL_ABOVE_AVG_MULTIPLIER) badges.push("High CPL");
  }
  if (adset.learningStatus === "LEARNING_LIMITED" || adset.learningStatus === "LEARNING") badges.push("Learning");
  if ((adset.deliveryStatus === "NO_DELIVERY" || adset.deliveryStatus === "UNDER_DELIVERY") && adset.spend === 0) badges.push("No delivery");
  if (adset.spend >= META_ADS_INSIGHTS.MIN_SPEND_FOR_CTR && adset.impressions >= META_ADS_INSIGHTS.MIN_IMPRESSIONS_LOW_CTR && adset.ctr < META_ADS_INSIGHTS.LOW_CTR_BASELINE && adset.effectiveStatus === "ACTIVE") badges.push("Low CTR");
  if (badges.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-0.5 mt-0.5">
      {badges.map((b) => (
        <span key={b} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-200">{b}</span>
      ))}
    </div>
  );
}

type Props = { adsets: MetaAdsAdSet[]; onRefresh?: () => void };

export function MetaAdsAdSetTable({ adsets, onRefresh }: Props) {
  const withLeads = adsets.filter((a) => a.leads >= 1);
  const avgCpl = withLeads.length > 0
    ? withLeads.reduce((s, a) => s + (a.costPerLead ?? a.spend / a.leads), 0) / withLeads.length
    : null;
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-3">Ad Sets</h2>
      <div className="overflow-x-auto -mx-4">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-neutral-800 text-left">
              <th className="py-2 px-3 font-medium text-neutral-400">Ad Set</th>
              <th className="py-2 px-3 font-medium text-neutral-400">Status</th>
              <th className="py-2 px-3 font-medium text-neutral-400">Delivery</th>
              <th className="py-2 px-3 font-medium text-neutral-400">Spend</th>
              <th className="py-2 px-3 font-medium text-neutral-400">Leads</th>
              <th className="py-2 px-3 font-medium text-neutral-400">CPL</th>
              <th className="py-2 px-3 font-medium text-neutral-400">CTR</th>
              <th className="py-2 px-3 font-medium text-neutral-400">Freq</th>
              <th className="py-2 px-3 font-medium text-neutral-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {adsets.map((a) => (
              <tr key={a.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                <td className="py-2 px-3">
                  <div>
                    <span className="text-neutral-200 truncate max-w-[180px]" title={a.name}>{a.name}</span>
                    <RowBadges adset={a} avgCpl={avgCpl} />
                  </div>
                </td>
                <td className="py-2 px-3">
                  <span
                    className={
                      a.effectiveStatus === "ACTIVE"
                        ? "text-emerald-400"
                        : a.effectiveStatus === "PAUSED"
                          ? "text-amber-400"
                          : "text-neutral-400"
                    }
                    title={a.status !== a.effectiveStatus ? `Effective: ${a.effectiveStatus}, configured: ${a.status}` : undefined}
                  >
                    {a.effectiveStatus}
                    {a.status && a.status !== a.effectiveStatus && (
                      <span className="text-neutral-500 text-xs ml-0.5">(cfg: {a.status})</span>
                    )}
                  </span>
                </td>
                <td className="py-2 px-3 text-neutral-500 text-xs">{a.deliveryStatus ?? a.learningStatus ?? "—"}</td>
                <td className="py-2 px-3 text-neutral-300">{fmt(a.spend, true)}</td>
                <td className="py-2 px-3 text-neutral-400">{fmt(a.leads)}</td>
                <td className="py-2 px-3 text-neutral-400">
                  {a.costPerLead != null && a.costPerLead > 0 ? fmt(a.costPerLead, true) : "—"}
                </td>
                <td className="py-2 px-3 text-neutral-400">{a.ctr > 0 ? `${a.ctr.toFixed(2)}%` : "—"}</td>
                <td className="py-2 px-3 text-neutral-400">
                  {a.frequency != null && a.frequency > 0 ? a.frequency.toFixed(1) : "—"}
                </td>
                <td className="py-2 px-3">
                  {onRefresh && (
                    <MetaAdsStatusActions
                      level="adset"
                      id={a.id}
                      name={a.name}
                      effectiveStatus={a.effectiveStatus}
                      onSuccess={onRefresh}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {adsets.length === 0 && (
        <p className="text-neutral-500 text-sm py-4 text-center">No ad sets in selected range</p>
      )}
    </section>
  );
}
