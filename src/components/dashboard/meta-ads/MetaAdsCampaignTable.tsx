"use client";

import type { MetaAdsCampaign } from "@/lib/meta-ads/types";

function fmt(v: number, isMoney = false): string {
  return isMoney ? `$${v.toFixed(2)}` : v.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function MetaAdsCampaignTable({ campaigns }: { campaigns: MetaAdsCampaign[] }) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-3">Campaigns</h2>
      <div className="overflow-x-auto -mx-4">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-neutral-800 text-left">
              <th className="py-2 px-3 font-medium text-neutral-400">Campaign</th>
              <th className="py-2 px-3 font-medium text-neutral-400">Status</th>
              <th className="py-2 px-3 font-medium text-neutral-400">Spend</th>
              <th className="py-2 px-3 font-medium text-neutral-400">Impr</th>
              <th className="py-2 px-3 font-medium text-neutral-400">Clicks</th>
              <th className="py-2 px-3 font-medium text-neutral-400">CTR</th>
              <th className="py-2 px-3 font-medium text-neutral-400">Leads</th>
              <th className="py-2 px-3 font-medium text-neutral-400">CPL</th>
              <th className="py-2 px-3 font-medium text-neutral-400">Freq</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                <td className="py-2 px-3 text-neutral-200 truncate max-w-[180px]" title={c.name}>
                  {c.name}
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
                  >
                    {c.effectiveStatus}
                  </span>
                </td>
                <td className="py-2 px-3 text-neutral-300">{fmt(c.spend, true)}</td>
                <td className="py-2 px-3 text-neutral-400">{fmt(c.impressions)}</td>
                <td className="py-2 px-3 text-neutral-400">{fmt(c.clicks)}</td>
                <td className="py-2 px-3 text-neutral-400">{c.ctr > 0 ? `${c.ctr.toFixed(2)}%` : "—"}</td>
                <td className="py-2 px-3 text-neutral-300">{fmt(c.leads)}</td>
                <td className="py-2 px-3 text-neutral-400">
                  {c.costPerLead != null && c.costPerLead > 0 ? fmt(c.costPerLead, true) : "—"}
                </td>
                <td className="py-2 px-3 text-neutral-400">
                  {c.frequency != null && c.frequency > 0 ? c.frequency.toFixed(1) : "—"}
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
