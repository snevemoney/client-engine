"use client";

import type { MetaAdsSummary } from "@/lib/meta-ads/types";

function fmtNum(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}
function fmtMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

const KPIS: Array<{ key: keyof MetaAdsSummary; label: string; fmt: (v: number) => string }> = [
  { key: "spend", label: "Spend", fmt: fmtMoney },
  { key: "impressions", label: "Impressions", fmt: fmtNum },
  { key: "clicks", label: "Clicks", fmt: fmtNum },
  { key: "leads", label: "Leads", fmt: fmtNum },
  { key: "costPerLead", label: "CPL", fmt: (v) => (v > 0 ? fmtMoney(v) : "—") },
  { key: "ctr", label: "CTR %", fmt: (v) => (v > 0 ? `${v.toFixed(2)}%` : "—") },
  { key: "cpc", label: "CPC", fmt: (v) => (v > 0 ? fmtMoney(v) : "—") },
  { key: "cpm", label: "CPM", fmt: (v) => (v > 0 ? fmtMoney(v) : "—") },
  { key: "frequency", label: "Freq", fmt: (v) => (v > 0 ? v.toFixed(1) : "—") },
];

export function MetaAdsKpiCards({ summary }: { summary: MetaAdsSummary }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {KPIS.map(({ key, label, fmt }) => {
        const raw = summary[key];
        const v = typeof raw === "number" ? raw : raw ?? 0;
        return (
          <div
            key={key}
            className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 min-w-0"
          >
            <p className="text-neutral-500 text-xs uppercase tracking-wider truncate">
              {label}
            </p>
            <p className="text-neutral-200 font-semibold truncate">
              {fmt(v)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
