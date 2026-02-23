"use client";

import type { MetaAdsAd } from "@/lib/meta-ads/types";
import { META_ADS_INSIGHTS } from "@/lib/meta-ads/constants";
import { MetaAdsStatusActions } from "./MetaAdsStatusActions";

function fmt(v: number, isMoney = false): string {
  return isMoney ? `$${v.toFixed(2)}` : v.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function RowBadges({ ad }: { ad: MetaAdsAd }) {
  const badges: string[] = [];
  if (ad.spend >= META_ADS_INSIGHTS.MIN_SPEND_FOR_CTR && ad.impressions >= META_ADS_INSIGHTS.MIN_IMPRESSIONS_LOW_CTR && ad.ctr < META_ADS_INSIGHTS.LOW_CTR_BASELINE && ad.effectiveStatus === "ACTIVE") badges.push("Low CTR");
  if (badges.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-0.5 mt-0.5">
      {badges.map((b) => (
        <span key={b} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-200">{b}</span>
      ))}
    </div>
  );
}

type Props = { ads: MetaAdsAd[]; onRefresh?: () => void };

export function MetaAdsAdTable({ ads, onRefresh }: Props) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-3">Ads / Creatives</h2>
      <div className="overflow-x-auto -mx-4">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-neutral-800 text-left">
              <th className="py-2 px-3 font-medium text-neutral-400">Ad</th>
              <th className="py-2 px-3 font-medium text-neutral-400">Status</th>
              <th className="py-2 px-3 font-medium text-neutral-400">Spend</th>
              <th className="py-2 px-3 font-medium text-neutral-400">CTR</th>
              <th className="py-2 px-3 font-medium text-neutral-400">Leads</th>
              <th className="py-2 px-3 font-medium text-neutral-400">CPL</th>
              <th className="py-2 px-3 font-medium text-neutral-400">Freq</th>
              <th className="py-2 px-3 font-medium text-neutral-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {ads.map((a) => (
              <tr key={a.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                <td className="py-2 px-3">
                  <div>
                    <span className="text-neutral-200 truncate max-w-[200px]" title={a.name}>{a.name}</span>
                    <RowBadges ad={a} />
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
                <td className="py-2 px-3 text-neutral-300">{fmt(a.spend, true)}</td>
                <td className="py-2 px-3 text-neutral-400">{a.ctr > 0 ? `${a.ctr.toFixed(2)}%` : "—"}</td>
                <td className="py-2 px-3 text-neutral-400">{fmt(a.leads)}</td>
                <td className="py-2 px-3 text-neutral-400">
                  {a.costPerLead != null && a.costPerLead > 0 ? fmt(a.costPerLead, true) : "—"}
                </td>
                <td className="py-2 px-3 text-neutral-400">
                  {a.frequency != null && a.frequency > 0 ? a.frequency.toFixed(1) : "—"}
                </td>
                <td className="py-2 px-3">
                  {onRefresh && (
                    <MetaAdsStatusActions
                      level="ad"
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
      {ads.length === 0 && (
        <p className="text-neutral-500 text-sm py-4 text-center">No ads in selected range</p>
      )}
    </section>
  );
}
