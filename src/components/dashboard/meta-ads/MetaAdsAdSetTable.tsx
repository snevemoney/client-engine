"use client";

import type { MetaAdsAdSet } from "@/lib/meta-ads/types";

function fmt(v: number, isMoney = false): string {
  return isMoney ? `$${v.toFixed(2)}` : v.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function MetaAdsAdSetTable({ adsets }: { adsets: MetaAdsAdSet[] }) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-3">Ad Sets</h2>
      <div className="overflow-x-auto -mx-4">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-neutral-800 text-left">
              <th className="py-2 px-3 font-medium text-neutral-400">Ad Set</th>
              <th className="py-2 px-3 font-medium text-neutral-400">Status</th>
              <th className="py-2 px-3 font-medium text-neutral-400">Spend</th>
              <th className="py-2 px-3 font-medium text-neutral-400">Leads</th>
              <th className="py-2 px-3 font-medium text-neutral-400">CPL</th>
              <th className="py-2 px-3 font-medium text-neutral-400">CTR</th>
              <th className="py-2 px-3 font-medium text-neutral-400">Freq</th>
            </tr>
          </thead>
          <tbody>
            {adsets.map((a) => (
              <tr key={a.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                <td className="py-2 px-3 text-neutral-200 truncate max-w-[180px]" title={a.name}>
                  {a.name}
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
                  >
                    {a.effectiveStatus}
                  </span>
                </td>
                <td className="py-2 px-3 text-neutral-300">{fmt(a.spend, true)}</td>
                <td className="py-2 px-3 text-neutral-400">{fmt(a.leads)}</td>
                <td className="py-2 px-3 text-neutral-400">
                  {a.costPerLead != null && a.costPerLead > 0 ? fmt(a.costPerLead, true) : "—"}
                </td>
                <td className="py-2 px-3 text-neutral-400">{a.ctr > 0 ? `${a.ctr.toFixed(2)}%` : "—"}</td>
                <td className="py-2 px-3 text-neutral-400">
                  {a.frequency != null && a.frequency > 0 ? a.frequency.toFixed(1) : "—"}
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
