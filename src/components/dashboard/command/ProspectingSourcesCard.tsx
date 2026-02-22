"use client";

import type { ProspectingSourceMetrics } from "@/lib/ops/types";

export function ProspectingSourcesCard({ data }: { data: ProspectingSourceMetrics | null }) {
  if (!data) {
    return (
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-2">Prospecting sources</h2>
        <p className="text-xs text-neutral-500">Loading…</p>
      </section>
    );
  }

  const { bestSourceThisMonth, weakSourceWarning, rows } = data;

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-3">Channel ROI (prospecting sources this month)</h2>
      {data.channelRoiSummary && (
        <p className="text-xs text-emerald-400 mb-2">{data.channelRoiSummary}</p>
      )}
      {data.bestSourceThisMonth && !data.channelRoiSummary && (
        <p className="text-xs text-emerald-400 mb-2">
          Best source: <span className="font-medium">{data.bestSourceThisMonth}</span>
        </p>
      )}
      {data.weakSourceWarning && (
        <p className="text-xs text-amber-400 mb-2">{data.weakSourceWarning}</p>
      )}
      {data.rows.length === 0 ? (
        <p className="text-xs text-neutral-500">No leads with source channel this month. Set leadSourceChannel on leads.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-neutral-500 border-b border-neutral-700">
                <th className="py-1.5 pr-2">Channel</th>
                <th className="py-1.5 pr-2 text-right">Inq.</th>
                <th className="py-1.5 pr-2 text-right">Qual.</th>
                <th className="py-1.5 pr-2 text-right">Props.</th>
                <th className="py-1.5 pr-2 text-right">Won</th>
                <th className="py-1.5 pr-2 text-right">Conversion</th>
                <th className="py-1.5 pr-2 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.channel} className="border-b border-neutral-800/50">
                  <td className="py-1.5 pr-2 text-neutral-200">{r.channel}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{r.newLeads}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{r.qualified}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{r.proposals}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{r.won}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">
                    {r.conversionPct != null ? `${r.conversionPct}%` : "—"}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-neutral-300">
                    {r.cashCollected > 0 ? `$${r.cashCollected.toLocaleString()}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[10px] text-neutral-600 mt-2">Inq. = inquiries (new leads). Qual. = qualified. Props. = proposals sent. Manual entry OK for revenue.</p>
    </section>
  );
}
