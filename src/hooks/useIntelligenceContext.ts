"use client";

/**
 * Phase 4: Client-side hook for cross-page intelligence sharing.
 * Fetches unified risk + NBA + score context via /api/intelligence/context.
 * Built on useRetryableFetch for retry, abort, loading/error state.
 */

import { useRetryableFetch } from "./useRetryableFetch";

export interface IntelligenceRiskFlag {
  id: string;
  title: string;
  severity: string;
  ruleKey: string;
}

export interface IntelligenceAction {
  id: string;
  title: string;
  priority: string;
  score: number;
  actionUrl: string | null;
  templateKey: string | null;
}

export interface IntelligenceContext {
  risk: {
    openCount: number;
    criticalCount: number;
    highCount: number;
    topFlags: IntelligenceRiskFlag[];
  };
  nba: {
    queuedCount: number;
    criticalCount: number;
    highCount: number;
    topActions: IntelligenceAction[];
  };
  score: {
    value: number;
    band: string;
    delta: number;
    computedAt: string;
  } | null;
  entityType: string;
  entityId: string;
}

export function useIntelligenceContext(
  entityType = "command_center",
  entityId = "command_center",
  options: { enabled?: boolean } = {},
) {
  const { enabled = true } = options;
  const url = `/api/intelligence/context?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`;

  const { data, loading, error, refetch } = useRetryableFetch<IntelligenceContext>(url, { enabled });

  return {
    risk: data?.risk ?? null,
    nba: data?.nba ?? null,
    score: data?.score ?? null,
    loading,
    error,
    refetch,
  };
}
