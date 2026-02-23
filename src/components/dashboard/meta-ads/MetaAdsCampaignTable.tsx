"use client";

import type { MetaAdsCampaign } from "@/lib/meta-ads/types";
import { META_ADS_INSIGHTS } from "@/lib/meta-ads/constants";
import { MetaAdsStatusActions } from "./MetaAdsStatusActions";

function fmt(v: number, isMoney = false): string {
  return isMoney ? `$${v.toFixed(2)}` : v.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function RowBadges({ campaign, avgCpl }: { campaign: MetaAdsCampaign; avgCpl: number | null }) {
  const badges: string[] = [];
  if (campaign.spend >= META_ADS_INSIGHTS.HIGH_SPEND_NO_LEADS && campaign.leads === 0 && campaign.effectiveStatus === "ACTIVE") badges.push("No leads");
  if (campaign.frequency != null && campaign.frequency > META_ADS_INSIGHTS.FREQUENCY_FATIGUE_THRESHOLD) badges.push("Fatigue");
  if (avgCpl != null && campaign.leads >= 1) {
    const cpl = campaign.costPerLead ?? (campaign.spend / campaign.leads);
    if (cpl > avgCpl * META_ADS_INSIGHTS.CPL_ABOVE_AVG_MULTIPLIER) badges.push("High CPL");
  }
  if (campaign.learningStatus === "LEARNING_LIMITED" || campaign.learningStatus === "LEARNING") badges.push("Learning");
  if ((campaign.deliveryStatus === "NO_DELIVERY" || campaign.deliveryStatus === "UNDER_DELIVERY") && campaign.spend === 0) badges.push("No delivery");
  if (badges.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-0.5">
      {badges.map((b) => (
        <span key={b} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-200">
          {b}
        </span>
      ))}
    </div>
  );
}

type Props = { campaigns: MetaAdsCampaign[]; onRefresh?: () => void };

export function MetaAdsCampaignTable({ campaigns, onRefresh }: Props) {
  const withLeads = campaigns.filter((c) => c.leads >= 1);
  const avgCpl = withLeads.length > 0
    ? withLeads.reduce((s, c) => s + (c.costPerLead ?? c.spend / c.leads), 0) / withLeads.length
    : null;
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-3">Campaigns</h2>
      <div className="overflow-x-auto -mx-4">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-neutral-800 text-left">
              <th className="py-2 px-3 font-medium text-neutral-400">Campaign</th>
              <th className="py-2 px-3 font-medium text-neutral-400">Status</th>
              <th className="py-2 px-3 font-medium text-neutral-400">Delivery</th>
              <th className="py-2 px-3 font-medium text-neutral-400">Spend</th>
              <th className="py-2 px-3 font-medium text-neutral-400">Impr</th>
              <th className="py-2 px-3 font-medium text-neutral-400">Clicks</th>
              <th className="py-2 px-3 font-medium text-neutral-400">CTR</th>
              <th className="py-2 px-3 font-medium text-neutral-400">Leads</th>
              <th className="py-2 px-3 font-medium text-neutral-400">CPL</th>
              <th className="py-2 px-3 font-medium text-neutral-400">Freq</th>
              <th className="py-2 px-3 font-medium text-neutral-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                <td className="py-2 px-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-neutral-200 truncate max-w-[180px]" title={c.name}>{c.name}</span>
                    <RowBadges campaign={c} avgCpl={avgCpl} />
                  </div>
                </td>
                <td className="py-2 px-3">
                  <span
                    className={
                      c.effectiveStatus === "ACTIVE"
                        ? "text-emerald-400"
                        : c.effectiveStatus === "PAUSED"
                          ? "text-amber-400"
                          : "text-neutral-400"
                    }
                    title={c.status !== c.effectiveStatus ? `Effective: ${c.effectiveStatus}, configured: ${c.status}` : undefined}
                  >
                    {c.effectiveStatus}
                    {c.status && c.status !== c.effectiveStatus && (
                      <span className="text-neutral-500 text-xs ml-0.5">(cfg: {c.status})</span>
                    )}
                  </span>
                </td>
                <td className="py-2 px-3 text-neutral-500 text-xs">
                  {c.deliveryStatus ?? c.learningStatus ?? "—"}
                </td>
                <td className="py-2 px-3 text-neutral-300">{fmt(c.spend, true)}</td>
                <td className="py-2 px-3 text-neutral-400">{fmt(c.impressions)}</td>
                <td className="py-2 px-3 text-neutral-400">{fmt(c.clicks)}</td>
                <td className="py-2 px-3 text-neutral-400">
                  <div className="flex flex-col">
                    {c.ctr > 0 ? `${c.ctr.toFixed(2)}%` : "—"}
                    {c.ctrDeltaPct != null && (
                      <span className={`text-[10px] ${c.ctrDeltaPct >= 0 ? "text-emerald-400" : "text-amber-400"}`}>
                        {c.ctrDeltaPct >= 0 ? "+" : ""}{c.ctrDeltaPct.toFixed(0)}% vs prior
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2 px-3 text-neutral-300">{fmt(c.leads)}</td>
                <td className="py-2 px-3 text-neutral-400">
                  <div className="flex flex-col">
                    {c.costPerLead != null && c.costPerLead > 0 ? fmt(c.costPerLead, true) : "—"}
                    {c.cplDeltaPct != null && (
                      <span className={`text-[10px] ${c.cplDeltaPct <= 0 ? "text-emerald-400" : "text-amber-400"}`}>
                        {c.cplDeltaPct >= 0 ? "+" : ""}{c.cplDeltaPct.toFixed(0)}% vs prior
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2 px-3 text-neutral-400">
                  <div className="flex flex-col">
                    {c.frequency != null && c.frequency > 0 ? c.frequency.toFixed(1) : "—"}
                    {c.frequencyDeltaPct != null && (
                      <span className={`text-[10px] ${c.frequencyDeltaPct <= 0 ? "text-emerald-400" : "text-amber-400"}`}>
                        {c.frequencyDeltaPct >= 0 ? "+" : ""}{c.frequencyDeltaPct.toFixed(0)}% vs prior
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2 px-3">
                  {onRefresh && (
                    <MetaAdsStatusActions
                      level="campaign"
                      id={c.id}
                      name={c.name}
                      effectiveStatus={c.effectiveStatus}
                      onSuccess={onRefresh}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {campaigns.length === 0 && (
        <p className="text-neutral-500 text-sm py-4 text-center">No campaigns in selected range</p>
      )}
    </section>
  );
}
