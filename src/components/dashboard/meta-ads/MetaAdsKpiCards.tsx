"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import type { MetaAdsSummary } from "@/lib/meta-ads/types";

function fmtNum(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
}
function fmtMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

const KPIS: Array<{ key: keyof MetaAdsSummary; label: string; fmt: (v: number) => string; deltaKey?: keyof MetaAdsSummary }> = [
  { key: "spend", label: "Spend", fmt: fmtMoney, deltaKey: "spendDeltaPct" },
  { key: "impressions", label: "Impressions", fmt: fmtNum },
  { key: "clicks", label: "Clicks", fmt: fmtNum },
  { key: "leads", label: "Leads", fmt: fmtNum, deltaKey: "leadsDeltaPct" },
  { key: "costPerLead", label: "CPL", fmt: (v) => (v > 0 ? fmtMoney(v) : "—"), deltaKey: "cplDeltaPct" },
  { key: "ctr", label: "CTR %", fmt: (v) => (v > 0 ? `${v.toFixed(2)}%` : "—"), deltaKey: "ctrDeltaPct" },
  { key: "cpc", label: "CPC", fmt: (v) => (v > 0 ? fmtMoney(v) : "—"), deltaKey: "cpcDeltaPct" },
  { key: "cpm", label: "CPM", fmt: (v) => (v > 0 ? fmtMoney(v) : "—"), deltaKey: "cpmDeltaPct" },
  { key: "frequency", label: "Freq", fmt: (v) => (v > 0 ? v.toFixed(1) : "—"), deltaKey: "frequencyDeltaPct" },
];

function TrendIndicator({ deltaPct }: { deltaPct: number | null }) {
  if (deltaPct == null) return null;
  const isUp = deltaPct > 0;
  const isGoodForLeads = false; // caller can pass; for leads/ctr up is good, for cpl/spend up might be bad
  return (
    <span
      className={`ml-1 inline-flex items-center text-xs ${
        isUp ? "text-emerald-400" : "text-amber-400"
      }`}
      title={`${isUp ? "+" : ""}${deltaPct.toFixed(1)}% vs prior period`}
    >
      {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      <span className="ml-0.5">{isUp ? "+" : ""}{deltaPct.toFixed(1)}%</span>
    </span>
  );
}

export function MetaAdsKpiCards({ summary }: { summary: MetaAdsSummary }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {KPIS.map(({ key, label, fmt, deltaKey }) => {
        const raw = summary[key];
        const v = typeof raw === "number" ? raw : raw ?? 0;
        const delta = deltaKey ? (summary[deltaKey] as number | null) : null;
        return (
          <div
            key={key}
            className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 min-w-0"
          >
            <p className="text-neutral-500 text-xs uppercase tracking-wider truncate">
              {label}
            </p>
            <p className="text-neutral-200 font-semibold truncate flex items-center flex-wrap">
              {fmt(v)}
              {delta != null && <TrendIndicator deltaPct={delta} />}
            </p>
          </div>
        );
      })}
    </div>
  );
}
