"use client";

/**
 * Phase 8.0: Domain-specific context hook.
 * Fetches unified context from /api/internal/{domain}/context.
 * Reduces client fetches; surfaces NBA + risk signals per domain.
 */
import { useRetryableFetch } from "./useRetryableFetch";
import type { IntelligenceContext } from "./useIntelligenceContext";

export type DomainContextType = "growth" | "delivery" | "retention" | "leads";

export interface DomainRisk {
  openCount: number;
  criticalCount: number;
  highCount: number;
  topFlags: Array<{ id: string; title: string; severity: string; ruleKey: string }>;
}

export interface DomainNBA {
  queuedCount: number;
  criticalCount: number;
  highCount: number;
  topActions: Array<{
    id: string;
    title: string;
    priority: string;
    score: number;
    actionUrl: string | null;
    templateKey: string | null;
  }>;
}

export interface GrowthContext {
  summary: {
    countsByStage: Record<string, number>;
    overdueFollowUps: Array<{ id: string; prospectName: string; stage: string; nextFollowUpAt: string }>;
    next7DaysFollowUps: Array<{ id: string; prospectName: string; stage: string; nextFollowUpAt: string }>;
    lastActivityAt: string | null;
  };
  risk: DomainRisk;
  nba: DomainNBA;
}

export interface DeliveryContext {
  summary: {
    inProgress: number;
    dueSoon: number;
    overdue: number;
    completedThisWeek: number;
    proofRequestedPending: number;
  };
  handoffSummary: {
    completedNoHandoff: number;
    handoffInProgress: number;
    handoffMissingClientConfirm: number;
  };
  risk: DomainRisk;
  nba: DomainNBA;
}

export interface RetentionContext {
  summary: {
    dueToday: number;
    overdue: number;
    upcoming: number;
    testimonialRequested: number;
    testimonialReceived: number;
    reviewRequested: number;
    reviewReceived: number;
    referralRequested: number;
    referralReceived: number;
    retainerOpen: number;
    upsellOpen: number;
    closedWon: number;
    closedLost: number;
    stalePostDelivery: number;
  };
  risk: DomainRisk;
  nba: DomainNBA;
}

export interface LeadsContext {
  pipeline: {
    byStage: Record<string, number>;
    stuckOver7d: number;
    noNextStep: number;
    wonNoDelivery: number;
  };
  risk: DomainRisk;
  nba: DomainNBA;
}

export type DomainContext = GrowthContext | DeliveryContext | RetentionContext | LeadsContext;

export function useDomainContext(
  domain: DomainContextType,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;
  const url = `/api/internal/${domain}/context`;

  const { data, loading, error, refetch } = useRetryableFetch<DomainContext>(url, { enabled });

  return {
    data,
    loading,
    error,
    refetch,
    risk: (data?.risk ?? null) as IntelligenceContext["risk"] | null,
    nba: (data?.nba ?? null) as IntelligenceContext["nba"] | null,
  };
}
