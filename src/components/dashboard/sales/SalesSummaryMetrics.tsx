"use client";

import { useState, useEffect } from "react";

type Metrics = {
  intake: { newThisWeek: number; qualified: number; sent: number; won: number; wonThisWeek?: number } | null;
  proposals: { drafts: number; ready: number; sentThisWeek: number; acceptedThisWeek: number; avgProposalValue: number | null } | null;
};

export function SalesSummaryMetrics() {
  const [metrics, setMetrics] = useState<Metrics>({ intake: null, proposals: null });

  useEffect(() => {
    Promise.allSettled([
      fetch("/api/intake-leads/summary", { cache: "no-store" }).then((r) => r.ok ? r.json() : null),
      fetch("/api/proposals/summary", { cache: "no-store" }).then((r) => r.ok ? r.json() : null),
    ]).then(([intake, proposals]) => {
      setMetrics({
        intake: intake.status === "fulfilled" ? intake.value : null,
        proposals: proposals.status === "fulfilled" ? proposals.value : null,
      });
    });
  }, []);

  const items = [
    { label: "New Leads (Week)", value: metrics.intake?.newThisWeek ?? "—" },
    { label: "Proposals Sent (Week)", value: metrics.proposals?.sentThisWeek ?? "—" },
    { label: "Won This Week", value: metrics.intake?.wonThisWeek != null ? metrics.intake.wonThisWeek : "—", highlight: true },
    { label: "Avg Proposal Value", value: metrics.proposals?.avgProposalValue ? `$${metrics.proposals.avgProposalValue.toLocaleString()}` : "—" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
          <p className="text-xs text-neutral-500">{item.label}</p>
          <p className={`text-xl font-semibold ${item.highlight ? "text-emerald-400" : ""}`}>{item.value}</p>
        </div>
      ))}
    </div>
  );
}
