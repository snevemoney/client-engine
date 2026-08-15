/**
 * Phase 5.1: Coach Mode tool layer.
 * Phase 2: Uses domain services directly (no HTTP self-calls).
 */

import { RiskStatus } from "@prisma/client";
import { NextActionStatus } from "@prisma/client";
import { getScoreContext as scoreGetContext, compute as scoreCompute } from "@/lib/services/score-service";
import { getSummary as riskGetSummary, list as riskList, runRules as riskRunRules } from "@/lib/services/risk-service";
import { getSummary as nbaGetSummary, list as nbaList, runRules as nbaRunRules } from "@/lib/services/nba-service";

export type ScoreContext = {
  latest: { id?: string; score: number; band: string; computedAt: string } | null;
  recentEvents: Array<{ eventType: string; createdAt: string; meta?: unknown }>;
  error?: string;
};

export type RiskContext = {
  summary: { openBySeverity: Record<string, number>; lastRunAt: string | null };
  top: Array<{ id: string; title: string; severity: string; status: string; ruleKey?: string }>;
  error?: string;
};

export type NBAContext = {
  summary: {
    top5: Array<{ id: string; title: string; priority: string; score: number }>;
    queuedByPriority: Record<string, number>;
    lastRunAt: string | null;
  };
  top: Array<{
    id: string;
    title: string;
    priority: string;
    score: number;
    reason: string | null;
    ruleKey?: string;
    dedupeKey?: string;
  }>;
  error?: string;
};

export type RunResult = { ok: boolean; error?: string; data?: unknown };

export async function getScoreContext(
  entityType: string,
  entityId: string
): Promise<ScoreContext> {
  try {
    const ctx = await scoreGetContext(entityType, entityId);
    return ctx;
  } catch (e) {
    return {
      latest: null,
      recentEvents: [],
      error: e instanceof Error ? e.message : "Failed to load score context",
    };
  }
}

export async function getRiskContext(): Promise<RiskContext> {
  try {
    const [summary, listRes] = await Promise.all([
      riskGetSummary(),
      riskList({ status: RiskStatus.open, take: 5 }),
    ]);
    return {
      summary: {
        openBySeverity: summary.openBySeverity,
        lastRunAt: summary.lastRunAt,
      },
      top: listRes.items.map((r) => ({
        id: r.id,
        title: r.title,
        severity: r.severity,
        status: r.status,
        ruleKey: r.createdByRule ?? undefined,
      })),
    };
  } catch (e) {
    return {
      summary: { openBySeverity: {}, lastRunAt: null },
      top: [],
      error: e instanceof Error ? e.message : "Failed to load risk context",
    };
  }
}

export async function getNBAContext(
  entityType: string,
  entityId: string
): Promise<NBAContext> {
  try {
    const [summary, listRes] = await Promise.all([
      nbaGetSummary(entityType, entityId),
      nbaList({ entityType, entityId, status: NextActionStatus.queued, take: 5 }),
    ]);
    return {
      summary: {
        top5: summary.top5.map((a) => ({
          id: a.id,
          title: a.title,
          priority: a.priority,
          score: a.score,
        })),
        queuedByPriority: summary.queuedByPriority,
        lastRunAt: summary.lastRunAt,
      },
      top: listRes.items.map((a) => ({
        id: a.id,
        title: a.title,
        priority: a.priority,
        score: a.score,
        reason: a.reason,
        ruleKey: a.createdByRule ?? undefined,
        dedupeKey: a.dedupeKey ?? undefined,
      })),
    };
  } catch (e) {
    return {
      summary: { top5: [], queuedByPriority: {}, lastRunAt: null },
      top: [],
      error: e instanceof Error ? e.message : "Failed to load NBA context",
    };
  }
}

export async function runRecomputeScore(
  entityType: string,
  entityId: string
): Promise<RunResult> {
  try {
    const result = await scoreCompute(entityType, entityId);
    return { ok: true, data: result };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Score compute failed",
    };
  }
}

export async function runRiskRules(ownerUserId?: string): Promise<RunResult> {
  try {
    const result = await riskRunRules(ownerUserId);
    return { ok: true, data: result };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Risk rules run failed",
    };
  }
}

export async function runNextActions(
  entityType: string,
  entityId: string,
  ownerUserId?: string
): Promise<RunResult> {
  try {
    const result = await nbaRunRules(entityType, entityId, ownerUserId);
    return { ok: true, data: result };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Next actions run failed",
    };
  }
}
