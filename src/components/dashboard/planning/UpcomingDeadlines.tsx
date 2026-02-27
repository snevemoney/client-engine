"use client";

import { useState, useEffect } from "react";

type FollowupSummary = { overdueCount: number; todayCount: number; completedThisWeek: number } | null;
type DeliverySummary = { inProgress: number; dueSoon: number; overdue: number } | null;
type ProposalFollowupSummary = { overdue: number; stale: number; noFollowup: number } | null;

export function UpcomingDeadlines() {
  const [followups, setFollowups] = useState<FollowupSummary>(null);
  const [delivery, setDelivery] = useState<DeliverySummary>(null);
  const [proposalFollowups, setProposalFollowups] = useState<ProposalFollowupSummary>(null);

  useEffect(() => {
    Promise.allSettled([
      fetch("/api/followups/summary", { cache: "no-store" }).then((r) => r.ok ? r.json() : null),
      fetch("/api/delivery-projects/summary", { cache: "no-store" }).then((r) => r.ok ? r.json() : null),
      fetch("/api/proposals/followup-summary", { cache: "no-store" }).then((r) => r.ok ? r.json() : null),
    ]).then(([fu, del, pfu]) => {
      setFollowups(fu.status === "fulfilled" ? fu.value : null);
      setDelivery(del.status === "fulfilled" ? del.value : null);
      setProposalFollowups(pfu.status === "fulfilled" ? pfu.value : null);
    });
  }, []);

  const sections = [
    {
      label: "Follow-ups",
      items: [
        { label: "Overdue", value: followups?.overdueCount ?? "—", warn: (followups?.overdueCount ?? 0) > 0 },
        { label: "Due Today", value: followups?.todayCount ?? "—" },
        { label: "Completed (Week)", value: followups?.completedThisWeek ?? "—" },
      ],
    },
    {
      label: "Delivery",
      items: [
        { label: "In Progress", value: delivery?.inProgress ?? "—" },
        { label: "Due Soon", value: delivery?.dueSoon ?? "—", warn: (delivery?.dueSoon ?? 0) > 0 },
        { label: "Overdue", value: delivery?.overdue ?? "—", warn: (delivery?.overdue ?? 0) > 0 },
      ],
    },
    {
      label: "Proposal Follow-ups",
      items: [
        { label: "Overdue", value: proposalFollowups?.overdue ?? "—", warn: (proposalFollowups?.overdue ?? 0) > 0 },
        { label: "Stale", value: proposalFollowups?.stale ?? "—" },
        { label: "No Follow-up", value: proposalFollowups?.noFollowup ?? "—" },
      ],
    },
  ];

  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-4 space-y-4">
      <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Upcoming Deadlines</h3>
      <div className="grid gap-4 md:grid-cols-3">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="text-xs text-neutral-400 font-medium mb-2">{section.label}</p>
            <div className="space-y-1.5">
              {section.items.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-500">{item.label}</span>
                  <span className={`font-medium ${item.warn ? "text-red-400" : "text-neutral-200"}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
