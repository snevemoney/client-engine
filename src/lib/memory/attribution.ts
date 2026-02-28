/**
 * Phase 7.3: Outcome attribution — before/after context for NBA and Copilot actions.
 */
import { db } from "@/lib/db";
import { OperatorAttributionSourceType } from "@prisma/client";
import { RiskStatus } from "@prisma/client";
import { NextActionStatus } from "@prisma/client";

export type AttributionContext = {
  score: { band: string; score: number; updatedAt: string } | null;
  risk: { openCount: number; criticalCount: number; topKeys: string[] };
  nba: { queuedCount: number; topRuleKeys: string[] };
  error?: string;
};

export type AttributionDelta = {
  scoreDelta: number | null;
  bandChange: { from: string; to: string } | null;
  riskOpenDelta: number;
  riskCriticalDelta: number;
  nbaQueuedDelta: number;
  error?: string;
};

const DEFAULT_ENTITY = { entityType: "command_center" as const, entityId: "command_center" };

/**
 * Load attribution context: score, risk, NBA summaries (scoped to command_center by default).
 */
export async function loadAttributionContext(
  _actorUserId: string,
  opts?: { entityType?: string; entityId?: string }
): Promise<AttributionContext> {
  const entityType = opts?.entityType ?? DEFAULT_ENTITY.entityType;
  const entityId = opts?.entityId ?? DEFAULT_ENTITY.entityId;

  try {
    const [scoreSnap, riskOpen, riskCritical, riskTop, nbaQueued, nbaTop] = await Promise.all([
      db.scoreSnapshot.findFirst({
        where: { entityType, entityId },
        orderBy: { computedAt: "desc" },
        select: { score: true, band: true, computedAt: true },
      }),
      db.riskFlag.count({ where: { status: RiskStatus.open } }),
      db.riskFlag.count({ where: { status: RiskStatus.open, severity: "critical" } }),
      db.riskFlag.findMany({
        where: { status: RiskStatus.open },
        orderBy: [{ severity: "desc" }, { lastSeenAt: "desc" }],
        take: 5,
        select: { key: true },
      }),
      db.nextBestAction.count({
        where: { entityType, entityId, status: NextActionStatus.queued },
      }),
      db.nextBestAction.findMany({
        where: { entityType, entityId, status: NextActionStatus.queued },
        orderBy: { score: "desc" },
        take: 10,
        select: { createdByRule: true },
      }),
    ]);

    const topKeys = riskTop.map((r) => r.key).filter(Boolean);
    const topRuleKeys = [...new Set(nbaTop.map((n) => n.createdByRule).filter(Boolean))];

    return {
      score: scoreSnap
        ? {
            band: scoreSnap.band,
            score: scoreSnap.score,
            updatedAt: scoreSnap.computedAt.toISOString(),
          }
        : null,
      risk: {
        openCount: riskOpen,
        criticalCount: riskCritical,
        topKeys,
      },
      nba: {
        queuedCount: nbaQueued,
        topRuleKeys,
      },
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      score: null,
      risk: { openCount: 0, criticalCount: 0, topKeys: [] },
      nba: { queuedCount: 0, topRuleKeys: [] },
      error,
    };
  }
}

/**
 * Compute attribution delta from before/after context.
 */
export function computeAttributionDelta(
  before: AttributionContext,
  after: AttributionContext
): AttributionDelta {
  const scoreDelta =
    before.score && after.score ? after.score.score - before.score.score : null;
  const bandChange =
    before.score && after.score && before.score.band !== after.score.band
      ? { from: before.score.band, to: after.score.band }
      : null;
  const riskOpenDelta = after.risk.openCount - before.risk.openCount;
  const riskCriticalDelta = after.risk.criticalCount - before.risk.criticalCount;
  const nbaQueuedDelta = after.nba.queuedCount - before.nba.queuedCount;

  return {
    scoreDelta,
    bandChange,
    riskOpenDelta,
    riskCriticalDelta,
    nbaQueuedDelta,
    ...(before.error || after.error ? { error: before.error || after.error } : {}),
  };
}

/** Map delta to outcome: improved | neutral | worsened. */
const SCORE_IMPROVED_THRESHOLD = 5;
const SCORE_WORSENED_THRESHOLD = -5;
const BAND_ORDER = ["critical", "warning", "healthy"]; // lower index = worse

function bandRank(b: string): number {
  const i = BAND_ORDER.indexOf(b);
  return i >= 0 ? i : 0;
}

export function deltaToOutcome(delta: AttributionDelta): "improved" | "neutral" | "worsened" {
  if (delta.error) return "neutral";

  if (delta.bandChange) {
    const fromRank = bandRank(delta.bandChange.from);
    const toRank = bandRank(delta.bandChange.to);
    if (toRank > fromRank) return "improved"; // higher index = better band (healthy > warning > critical)
    if (toRank < fromRank) return "worsened";
  }

  if (delta.riskCriticalDelta < 0) return "improved";
  if (delta.riskCriticalDelta > 0) return "worsened";

  if (delta.scoreDelta !== null) {
    if (delta.scoreDelta >= SCORE_IMPROVED_THRESHOLD) return "improved";
    if (delta.scoreDelta <= SCORE_WORSENED_THRESHOLD) return "worsened";
  }

  if (delta.riskOpenDelta < 0) return "improved";
  if (delta.riskOpenDelta > 2) return "worsened";

  return "neutral";
}

/**
 * Record attribution and optionally emit memory event with improved/neutral/worsened.
 */
export async function recordAttribution(params: {
  actorUserId: string;
  sourceType: "nba_execute" | "copilot_action";
  ruleKey: string | null;
  actionKey: string | null;
  entityType?: string;
  entityId?: string;
  before: AttributionContext;
  after: AttributionContext;
  delta: AttributionDelta;
  metaJson?: Record<string, unknown>;
}): Promise<string> {
  const { actorUserId, sourceType, ruleKey, actionKey, entityType, entityId, before, after, delta, metaJson } =
    params;

  const beforeJson = {
    score: before.score,
    risk: before.risk,
    nba: before.nba,
  };
  const afterJson = {
    score: after.score,
    risk: after.risk,
    nba: after.nba,
  };
  const deltaJson = {
    scoreDelta: delta.scoreDelta,
    bandChange: delta.bandChange,
    riskOpenDelta: delta.riskOpenDelta,
    riskCriticalDelta: delta.riskCriticalDelta,
    nbaQueuedDelta: delta.nbaQueuedDelta,
    ...(delta.error ? { error: delta.error } : {}),
  };

  const rec = await db.operatorAttribution.create({
    data: {
      actorUserId,
      sourceType: sourceType === "nba_execute" ? OperatorAttributionSourceType.nba_execute : OperatorAttributionSourceType.copilot_action,
      ruleKey,
      actionKey,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
      beforeJson,
      afterJson,
      deltaJson,
    },
  });

  return rec.id;
}
