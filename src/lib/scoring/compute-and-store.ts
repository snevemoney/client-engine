/**
 * Phase 3.1: Compute and store score snapshots, detect events, trigger notifications.
 */

import { db } from "@/lib/db";
import { computeScore } from "./engine";
import { buildReviewsFactors } from "./adapters/reviews";
import { buildCommandCenterFactors } from "./adapters/command-center";
import { fetchReviewsContext, fetchCommandCenterContext } from "./fetch-context";
import { createNotificationEvent } from "@/lib/notifications/service";
import { queueNotificationDeliveries } from "@/lib/notifications/service";
import { getScoreAlertsPreferences, shouldEmitScoreNotification } from "@/lib/scores/alerts-preferences";
import { isScoreNotificationInCooldown } from "@/lib/scores/notification-cooldown";
import { logOpsEventSafe } from "@/lib/ops-events/log";

export type ScoreEntityType = "review_stream" | "command_center";

const SHARP_DROP_THRESHOLD = 15;
const SCORE_EVENT_DEDUPE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export type ComputeAndStoreResult = {
  snapshotId: string;
  score: number;
  band: string;
  delta: number | null;
  eventsCreated: string[];
};

/** Get adapter factors for entity. */
async function getFactors(
  entityType: ScoreEntityType,
  entityId: string
): Promise<{ factors: import("./types").ScoreFactorInput[] }> {
  if (entityType === "review_stream") {
    const ctx = await fetchReviewsContext(entityId);
    if (!ctx) {
      return {
        factors: [
          {
            key: "no_data",
            label: "No review data",
            rawValue: 0,
            normalizedValue: 50,
            weight: 1,
            direction: "positive",
            reason: "Missing signal: no StrategyWeek for this week (defaulted)",
          },
        ],
      };
    }
    return { factors: buildReviewsFactors(ctx) };
  }

  if (entityType === "command_center") {
    const ctx = await fetchCommandCenterContext();
    return { factors: buildCommandCenterFactors(ctx) };
  }

  throw new Error(`Unknown entity type: ${entityType}`);
}

/** Load previous snapshot for delta. */
async function getPreviousSnapshot(
  entityType: string,
  entityId: string
): Promise<{ score: number; band: string } | null> {
  const prev = await db.scoreSnapshot.findFirst({
    where: { entityType, entityId },
    orderBy: { computedAt: "desc" },
    select: { score: true, band: true },
  });
  return prev;
}

/** Check if we should suppress duplicate event (same type + entity within window). */
async function shouldSuppressEvent(
  entityType: string,
  entityId: string,
  eventType: string,
  dedupeKey: string
): Promise<boolean> {
  const existing = await db.scoreEvent.findFirst({
    where: { dedupeKey },
    orderBy: { createdAt: "desc" },
  });
  if (!existing) return false;
  const ageMs = Date.now() - existing.createdAt.getTime();
  return ageMs < SCORE_EVENT_DEDUPE_WINDOW_MS;
}

/** Create score event and optionally trigger notification (respects alert preferences). */
async function createScoreEventAndNotify(opts: {
  entityType: string;
  entityId: string;
  eventType: "threshold_breach" | "sharp_drop" | "recovery";
  fromScore: number;
  toScore: number;
  delta: number;
  fromBand: string;
  toBand: string;
  reasons: { label: string; impact: number; direction: string }[];
}): Promise<string | null> {
  const dedupeKey = `score:${opts.entityType}:${opts.entityId}:${opts.eventType}`;
  const suppressed = await shouldSuppressEvent(
    opts.entityType,
    opts.entityId,
    opts.eventType,
    dedupeKey
  );
  if (suppressed) return null;

  const event = await db.scoreEvent.create({
    data: {
      entityType: opts.entityType,
      entityId: opts.entityId,
      eventType: opts.eventType,
      fromScore: opts.fromScore,
      toScore: opts.toScore,
      delta: opts.delta,
      fromBand: opts.fromBand,
      toBand: opts.toBand,
      reasonsJson: opts.reasons.slice(0, 3) as object,
      dedupeKey,
    },
  });

  const prefs = await getScoreAlertsPreferences().catch(() => null);
  const { emit, reason } = shouldEmitScoreNotification(opts.eventType, opts.delta, prefs);

  if (!emit && reason) {
    logOpsEventSafe({
      category: "automation",
      eventKey: "score.notification.suppressed",
      eventLabel: `Score ${opts.eventType} notification suppressed`,
      sourceType: "score",
      sourceId: event.id,
      meta: { eventType: opts.eventType, reason, entityType: opts.entityType, entityId: opts.entityId },
    });
    return event.id;
  }

  const cooldownMin = prefs?.cooldownMinutes ?? 60;
  const { inCooldown, lastNotificationAt } = await isScoreNotificationInCooldown(
    opts.entityType,
    opts.entityId,
    opts.eventType,
    cooldownMin
  );

  if (inCooldown) {
    logOpsEventSafe({
      category: "automation",
      eventKey: "score.notification.suppressed",
      eventLabel: `Score ${opts.eventType} notification suppressed (cooldown)`,
      sourceType: "score",
      sourceId: event.id,
      meta: {
        eventType: opts.eventType,
        reason: "cooldown_active",
        entityType: opts.entityType,
        entityId: opts.entityId,
        cooldownMinutes: cooldownMin,
        lastNotificationAt: lastNotificationAt?.toISOString(),
      },
    });
    return event.id;
  }

  const meta = {
    entityType: opts.entityType,
    entityId: opts.entityId,
    fromScore: opts.fromScore,
    toScore: opts.toScore,
    delta: opts.delta,
    fromBand: opts.fromBand,
    toBand: opts.toBand,
    topReasons: opts.reasons.slice(0, 2).map((r) => r.label),
  };

  const severity =
    opts.eventType === "recovery" ? "info" : opts.eventType === "threshold_breach" ? "critical" : "warning";
  const title =
    opts.eventType === "threshold_breach"
      ? `Score threshold breach: ${opts.entityType}`
      : opts.eventType === "sharp_drop"
        ? `Score sharp drop: ${opts.entityType}`
        : `Score recovered: ${opts.entityType}`;
  const message = `${opts.fromBand} → ${opts.toBand} (${opts.fromScore} → ${opts.toScore}, Δ${opts.delta >= 0 ? "+" : ""}${opts.delta})`;

  const { id: notifId, created } = await createNotificationEvent({
    eventKey: `score.${opts.eventType}`,
    title,
    message,
    severity: severity as "info" | "warning" | "critical",
    sourceType: "score",
    sourceId: event.id,
    actionUrl: `/dashboard/internal/qa/scores?entityType=${opts.entityType}&entityId=${encodeURIComponent(opts.entityId)}`,
    metaJson: meta,
    dedupeKey: `notif:${dedupeKey}`,
    createdByRule: "score_engine",
  });

  if (created) {
    await queueNotificationDeliveries(notifId);
  }

  return event.id;
}

/** Test-only override for deterministic event testing. Do not use in production. */
export type ComputeAndStoreContext = {
  _testOverride?: { score: number; band: import("./types").ScoreBand };
};

/** Compute and store score for an entity. */
export async function computeAndStoreScore(
  entityType: ScoreEntityType,
  entityId: string,
  context?: ComputeAndStoreContext
): Promise<ComputeAndStoreResult> {
  let result: import("./types").ScoreComputationResult;
  if (context?._testOverride) {
    const { score, band } = context._testOverride;
    result = {
      score,
      band,
      reasons: [],
      factorBreakdown: [],
      computedAt: new Date(),
    };
  } else {
    const { factors } = await getFactors(entityType, entityId);
    result = computeScore({ factors });
  }

  const previous = await getPreviousSnapshot(entityType, entityId);
  const delta = previous != null ? result.score - previous.score : null;

  const snapshot = await db.scoreSnapshot.create({
    data: {
      entityType,
      entityId,
      score: result.score,
      band: result.band,
      delta,
      factorsJson: result.factorBreakdown as object,
      reasonsJson: result.reasons as object,
      computedAt: result.computedAt,
    },
  });

  const eventsCreated: string[] = [];

  // Detect significant events
  if (previous != null) {
    const fromBand = previous.band;
    const toBand = result.band;
    const deltaVal = delta ?? 0;

    // Threshold breach to critical
    if (toBand === "critical" && fromBand !== "critical") {
      const id = await createScoreEventAndNotify({
        entityType,
        entityId,
        eventType: "threshold_breach",
        fromScore: previous.score,
        toScore: result.score,
        delta: deltaVal,
        fromBand,
        toBand,
        reasons: result.reasons,
      });
      if (id) eventsCreated.push(id);
    }

    // Sharp drop (delta <= -15)
    if (deltaVal <= -SHARP_DROP_THRESHOLD) {
      const id = await createScoreEventAndNotify({
        entityType,
        entityId,
        eventType: "sharp_drop",
        fromScore: previous.score,
        toScore: result.score,
        delta: deltaVal,
        fromBand,
        toBand,
        reasons: result.reasons,
      });
      if (id) eventsCreated.push(id);
    }

    // Recovery to healthy
    if (toBand === "healthy" && fromBand !== "healthy") {
      const id = await createScoreEventAndNotify({
        entityType,
        entityId,
        eventType: "recovery",
        fromScore: previous.score,
        toScore: result.score,
        delta: deltaVal,
        fromBand,
        toBand,
        reasons: result.reasons,
      });
      if (id) eventsCreated.push(id);
    }
  }

  return {
    snapshotId: snapshot.id,
    score: result.score,
    band: result.band,
    delta,
    eventsCreated,
  };
}
