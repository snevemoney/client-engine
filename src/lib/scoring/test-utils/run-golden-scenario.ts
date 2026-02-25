/**
 * Phase 3.6.5: Golden scenario runner — executes a scenario and returns normalized result.
 * DB-based (integration style), verifies persistence contracts.
 */

import { db } from "@/lib/db";
import { computeAndStoreScore } from "../compute-and-store";
import { updateScoreAlertsPreferences } from "@/lib/scores/alerts-preferences";
import type { GoldenScenario, GoldenScenarioId } from "../golden-scenarios";
import { getGoldenScenario } from "../golden-scenarios";

const GOLDEN_ENTITY = "golden_scenario_entity";

export type GoldenScenarioResult = {
  computeResult: {
    snapshotId: string;
    score: number;
    band: string;
    delta: number | null;
    eventsCreated: string[];
  };
  snapshot: {
    id: string;
    score: number;
    band: string;
    delta: number | null;
    entityType: string;
    entityId: string;
  } | null;
  scoreEvents: Array<{
    id: string;
    eventType: string;
    fromScore: number;
    toScore: number;
    delta: number;
    fromBand: string;
    toBand: string;
    dedupeKey: string;
  }>;
  notificationCount: number;
  deliveryCount: number;
};

/** Run a golden scenario and return normalized result for assertions. */
export async function runGoldenScenario(
  scenario: GoldenScenario | GoldenScenarioId,
  entityId: string = GOLDEN_ENTITY
): Promise<GoldenScenarioResult> {
  const s = typeof scenario === "string" ? getGoldenScenario(scenario) : scenario;
  if (!s) throw new Error(`Unknown scenario: ${scenario}`);

  const entityType = "command_center";

  await db.scoreEvent.deleteMany({ where: { entityId } });
  await db.scoreSnapshot.deleteMany({ where: { entityId } });
  await db.notificationEvent.deleteMany({ where: { sourceType: "score" } });

  if (s.preferencesOverride) {
    const p = s.preferencesOverride;
    const toUpdate: Parameters<typeof updateScoreAlertsPreferences>[0] = {};
    if (p.enabled !== undefined) toUpdate.enabled = p.enabled;
    if (p.cooldownMinutes !== undefined) toUpdate.cooldownMinutes = p.cooldownMinutes;
    if (p.events) {
      toUpdate.events = {
        threshold_breach: p.events.threshold_breach ?? true,
        sharp_drop: p.events.sharp_drop ?? true,
        recovery: p.events.recovery ?? true,
      };
    }
    await updateScoreAlertsPreferences(toUpdate);
  }

  if (s.priorSnapshot) {
    await computeAndStoreScore(entityType, entityId, {
      _testOverride: { score: s.priorSnapshot.score, band: s.priorSnapshot.band },
    });
  }

  if (s.id === "golden_notification_suppressed_by_cooldown") {
    const dedupeKey = `notif:score:${entityType}:${entityId}:threshold_breach`;
    await db.notificationEvent.create({
      data: {
        eventKey: "score.threshold_breach",
        title: "Pre-inserted",
        message: "Test",
        severity: "critical",
        sourceType: "score",
        sourceId: "pre",
        dedupeKey,
        status: "sent",
        occurredAt: new Date(),
      },
    });
  }

  const computeResult = await computeAndStoreScore(entityType, entityId, {
    _testOverride: s.currentOverride,
  });

  const [snapshot, scoreEvents, notificationCount, deliveryCount] = await Promise.all([
    db.scoreSnapshot.findUnique({
      where: { id: computeResult.snapshotId },
    }),
    db.scoreEvent.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.notificationEvent.count({
      where: { sourceType: "score" },
    }),
    db.notificationDelivery.count({
      where: {
        notificationEvent: { sourceType: "score" },
      },
    }),
  ]);

  return {
    computeResult: {
      snapshotId: computeResult.snapshotId,
      score: computeResult.score,
      band: computeResult.band,
      delta: computeResult.delta,
      eventsCreated: computeResult.eventsCreated,
    },
    snapshot: snapshot
      ? {
          id: snapshot.id,
          score: snapshot.score,
          band: snapshot.band,
          delta: snapshot.delta,
          entityType: snapshot.entityType,
          entityId: snapshot.entityId,
        }
      : null,
    scoreEvents: scoreEvents.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      fromScore: e.fromScore,
      toScore: e.toScore,
      delta: e.delta,
      fromBand: e.fromBand,
      toBand: e.toBand,
      dedupeKey: e.dedupeKey ?? "",
    })),
    notificationCount,
    deliveryCount,
  };
}

/** Restore alert preferences to defaults after scenario (call in test afterEach if needed). */
export async function restoreGoldenScenarioPreferences(): Promise<void> {
  await updateScoreAlertsPreferences({
    enabled: true,
    events: { threshold_breach: true, sharp_drop: true, recovery: true },
  });
}
