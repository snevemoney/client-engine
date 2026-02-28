"use client";

import { useCallback } from "react";
import { useRetryableFetch } from "@/hooks/useRetryableFetch";
import { AsyncState } from "@/components/ui/AsyncState";

type IntakeStats = { newThisWeek: number; qualified: number; sent: number; won: number };
type ProposalStats = { drafts: number; ready: number; sentThisWeek: number; acceptedThisWeek: number };
type DeliveryStats = { inProgress: number; dueSoon: number; overdue: number; completedThisWeek: number };

export function OverviewLiveStats() {
  const {
    data: intake,
    loading: intakeLoading,
    error: intakeError,
    refetch: refetchIntake,
  } = useRetryableFetch<IntakeStats>("/api/intake-leads/summary");

  const {
    data: proposals,
    loading: proposalsLoading,
    error: proposalsError,
    refetch: refetchProposals,
  } = useRetryableFetch<ProposalStats>("/api/proposals/summary");

  const {
    data: delivery,
    loading: deliveryLoading,
    error: deliveryError,
    refetch: refetchDelivery,
  } = useRetryableFetch<DeliveryStats>("/api/delivery-projects/summary");

  const loading = intakeLoading || proposalsLoading || deliveryLoading;
  const error = intakeError || proposalsError || deliveryError;

  const refetchAll = useCallback(() => {
    refetchIntake();
    refetchProposals();
    refetchDelivery();
  }, [refetchIntake, refetchProposals, refetchDelivery]);

  const items = [
    { label: "New Leads", value: intake?.newThisWeek ?? "—", sub: "this week" },
    { label: "Qualified", value: intake?.qualified ?? "—" },
    { label: "Proposals Sent", value: proposals?.sentThisWeek ?? "—", sub: "this week" },
    { label: "Accepted", value: proposals?.acceptedThisWeek ?? "—", sub: "this week" },
    { label: "Active Deliveries", value: delivery?.inProgress ?? "—" },
    { label: "Overdue", value: delivery?.overdue ?? "—", warn: (delivery?.overdue ?? 0) > 0 },
  ];

  return (
    <AsyncState loading={loading} error={error} onRetry={refetchAll}>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
            <p className="text-xs text-neutral-500">{item.label}</p>
            <p className={`text-xl font-semibold ${item.warn ? "text-red-400" : ""}`}>{item.value}</p>
            {item.sub && <p className="text-[10px] text-neutral-600">{item.sub}</p>}
          </div>
        ))}
      </div>
    </AsyncState>
  );
}
