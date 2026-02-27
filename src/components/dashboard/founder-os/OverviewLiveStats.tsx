"use client";

import { useState, useEffect } from "react";

type Stats = {
  intake: { newThisWeek: number; qualified: number; sent: number; won: number } | null;
  proposals: { drafts: number; ready: number; sentThisWeek: number; acceptedThisWeek: number } | null;
  delivery: { inProgress: number; dueSoon: number; overdue: number; completedThisWeek: number } | null;
};

export function OverviewLiveStats() {
  const [stats, setStats] = useState<Stats>({ intake: null, proposals: null, delivery: null });

  useEffect(() => {
    Promise.allSettled([
      fetch("/api/intake-leads/summary", { cache: "no-store" }).then((r) => r.ok ? r.json() : null),
      fetch("/api/proposals/summary", { cache: "no-store" }).then((r) => r.ok ? r.json() : null),
      fetch("/api/delivery-projects/summary", { cache: "no-store" }).then((r) => r.ok ? r.json() : null),
    ]).then(([intake, proposals, delivery]) => {
      setStats({
        intake: intake.status === "fulfilled" ? intake.value : null,
        proposals: proposals.status === "fulfilled" ? proposals.value : null,
        delivery: delivery.status === "fulfilled" ? delivery.value : null,
      });
    });
  }, []);

  const items = [
    { label: "New Leads", value: stats.intake?.newThisWeek ?? "—", sub: "this week" },
    { label: "Qualified", value: stats.intake?.qualified ?? "—" },
    { label: "Proposals Sent", value: stats.proposals?.sentThisWeek ?? "—", sub: "this week" },
    { label: "Accepted", value: stats.proposals?.acceptedThisWeek ?? "—", sub: "this week" },
    { label: "Active Deliveries", value: stats.delivery?.inProgress ?? "—" },
    { label: "Overdue", value: stats.delivery?.overdue ?? "—", warn: (stats.delivery?.overdue ?? 0) > 0 },
  ];

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
          <p className="text-xs text-neutral-500">{item.label}</p>
          <p className={`text-xl font-semibold ${item.warn ? "text-red-400" : ""}`}>{item.value}</p>
          {item.sub && <p className="text-[10px] text-neutral-600">{item.sub}</p>}
        </div>
      ))}
    </div>
  );
}
