/**
 * Phase 2: Score service — summary, history, compute.
 * Extracted from /api/internal/scores routes for use by coach-tools and routes.
 */

import { db } from "@/lib/db";
import { computeAndStoreScore } from "@/lib/scoring/compute-and-store";
import type { ScoreEntityType } from "@/lib/scoring/compute-and-store";

type FactorJson = { key?: string; label?: string; weight?: number; normalizedValue?: number; impact?: number; reason?: string };
type ReasonJson = { label?: string; impact?: number; direction?: string };

function parseFactors(factorsJson: unknown): Array<{
  key: string;
  label: string;
  weight: number;
  normalizedValue: number;
  impact: number;
  reason?: string;
}> {
  if (!Array.isArray(factorsJson)) return [];
  return factorsJson
    .filter((f): f is FactorJson => f != null && typeof f === "object")
    .map((f) => ({
      key: String(f.key ?? ""),
      label: String(f.label ?? f.key ?? "—"),
      weight: Number(f.weight) ?? 0,
      normalizedValue: Number(f.normalizedValue) ?? 0,
      impact: Number(f.impact) ?? 0,
      reason: typeof f.reason === "string" ? f.reason : undefined,
    }));
}

function parseReasons(reasonsJson: unknown): Array<{ label: string; impact: number; direction: string }> {
  if (!Array.isArray(reasonsJson)) return [];
  return reasonsJson
    .filter((r): r is ReasonJson => r != null && typeof r === "object")
    .map((r) => ({
      label: String(r.label ?? "—"),
      impact: Number(r.impact) ?? 0,
      direction: String(r.direction ?? "neutral"),
    }))
    .sort((a, b) => a.impact - b.impact);
}

export type ScoreSummary = {
  latest: {
    id?: string;
    score: number;
    band: string;
    delta?: number | null;
    computedAt: string;
    topReasons?: Array<{ label: string; impact: number; direction: string }>;
    factorSummary?: Array<{ key: string; label: string; weight: number; normalizedValue: number; impact: number; reason?: string }>;
  } | null;
  previous: {
    id: string;
    score: number;
    band: string;
    computedAt: string;
  } | null;
  previousFactorSummary: Array<{ key: string; label: string; weight: number; normalizedValue: number; impact: number; reason?: string }> | null;
  recentEvents: Array<{
    id: string;
    eventType: string;
    fromScore?: number | null;
    toScore?: number | null;
    delta?: number | null;
    fromBand?: string | null;
    toBand?: string | null;
    createdAt: string;
  }>;
};

/** For coach-tools: returns compact shape { latest, recentEvents } */
export type ScoreContext = {
  latest: { id?: string; score: number; band: string; computedAt: string } | null;
  recentEvents: Array<{ eventType: string; createdAt: string; meta?: unknown }>;
};

export async function getSummary(entityType: string, entityId: string): Promise<ScoreSummary> {
  const [latest, previous, events] = await Promise.all([
    db.scoreSnapshot.findFirst({
      where: { entityType, entityId },
      orderBy: { computedAt: "desc" },
    }),
    db.scoreSnapshot.findMany({
      where: { entityType, entityId },
      orderBy: { computedAt: "desc" },
      skip: 1,
      take: 1,
    }),
    db.scoreEvent.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const prevSnapshot = previous[0] ?? null;
  const latestData = latest
    ? {
        id: latest.id,
        score: latest.score,
        band: latest.band,
        delta: latest.delta,
        computedAt: latest.computedAt.toISOString(),
        topReasons: parseReasons(latest.reasonsJson),
        factorSummary: parseFactors(latest.factorsJson),
      }
    : null;

  const previousFactorSummary = prevSnapshot ? parseFactors(prevSnapshot.factorsJson) : null;

  return {
    latest: latestData,
    previous: prevSnapshot
      ? {
          id: prevSnapshot.id,
          score: prevSnapshot.score,
          band: prevSnapshot.band,
          computedAt: prevSnapshot.computedAt.toISOString(),
        }
      : null,
    previousFactorSummary,
    recentEvents: events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      fromScore: e.fromScore,
      toScore: e.toScore,
      delta: e.delta,
      fromBand: e.fromBand,
      toBand: e.toBand,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

/** For coach-tools: compact shape compatible with getScoreContext */
export async function getScoreContext(entityType: string, entityId: string): Promise<ScoreContext> {
  const summary = await getSummary(entityType, entityId);
  return {
    latest: summary.latest
      ? {
          id: summary.latest.id,
          score: summary.latest.score,
          band: summary.latest.band,
          computedAt: summary.latest.computedAt,
        }
      : null,
    recentEvents: summary.recentEvents.map((e) => ({
      eventType: e.eventType,
      createdAt: e.createdAt,
      meta: { fromScore: e.fromScore, toScore: e.toScore, delta: e.delta },
    })),
  };
}

function parseRange(range: string): { days: number } {
  if (range === "24h" || range === "1d") return { days: 1 };
  const m = range.match(/^(\d+)d$/);
  if (m) return { days: Math.min(90, Math.max(1, parseInt(m[1], 10))) };
  if (range === "7d") return { days: 7 };
  if (range === "30d") return { days: 30 };
  return { days: 7 };
}

export type ScoreHistory = {
  timeline: Array<{ id: string; score: number; band: string; delta: number | null; computedAt: string }>;
  events: Array<{
    id: string;
    eventType: string;
    fromScore: number | null;
    toScore: number | null;
    delta: number | null;
    fromBand: string | null;
    toBand: string | null;
    createdAt: string;
  }>;
};

export async function getHistory(
  entityType: string,
  entityId: string,
  range = "7d"
): Promise<ScoreHistory> {
  const { days } = parseRange(range);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [snapshots, events] = await Promise.all([
    db.scoreSnapshot.findMany({
      where: { entityType, entityId, computedAt: { gte: since } },
      orderBy: { computedAt: "asc" },
    }),
    db.scoreEvent.findMany({
      where: { entityType, entityId, createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return {
    timeline: snapshots.map((s) => ({
      id: s.id,
      score: s.score,
      band: s.band,
      delta: s.delta,
      computedAt: s.computedAt.toISOString(),
    })),
    events: events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      fromScore: e.fromScore,
      toScore: e.toScore,
      delta: e.delta,
      fromBand: e.fromBand,
      toBand: e.toBand,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

const VALID_ENTITY_TYPES: ScoreEntityType[] = ["review_stream", "command_center"];

export type ComputeResult = {
  snapshotId: string;
  score: number;
  band: string;
  delta: number | null;
  eventsCreated: string[];
};

export async function compute(entityType: string, entityId: string): Promise<ComputeResult> {
  if (!VALID_ENTITY_TYPES.includes(entityType as ScoreEntityType)) {
    throw new Error(`entityType must be one of: ${VALID_ENTITY_TYPES.join(", ")}`);
  }
  const result = await computeAndStoreScore(
    entityType as ScoreEntityType,
    String(entityId)
  );
  return {
    snapshotId: result.snapshotId,
    score: result.score,
    band: result.band,
    delta: result.delta,
    eventsCreated: result.eventsCreated,
  };
}
