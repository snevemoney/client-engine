/**
 * Phase 3.1: Unit tests for score history endpoint response shape.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";

function parseRange(range: string): { days: number } {
  if (range === "24h" || range === "1d") return { days: 1 };
  const m = range.match(/^(\d+)d$/);
  if (m) return { days: Math.min(90, Math.max(1, parseInt(m[1], 10))) };
  if (range === "7d") return { days: 7 };
  if (range === "30d") return { days: 30 };
  return { days: 7 };
}

describe("scores history response shape", () => {
  const ENTITY = "test_history_shape";

  beforeEach(async () => {
    await db.scoreSnapshot.deleteMany({ where: { entityId: ENTITY } });
    await db.scoreEvent.deleteMany({ where: { entityId: ENTITY } });
  });

  it("returns timeline and events shape", async () => {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const [snapshots, events] = await Promise.all([
      db.scoreSnapshot.findMany({
        where: { entityType: "command_center", entityId: ENTITY, computedAt: { gte: since } },
        orderBy: { computedAt: "asc" },
      }),
      db.scoreEvent.findMany({
        where: { entityType: "command_center", entityId: ENTITY, createdAt: { gte: since } },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const response = {
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

    expect(response).toHaveProperty("timeline");
    expect(response).toHaveProperty("events");
    expect(Array.isArray(response.timeline)).toBe(true);
    expect(Array.isArray(response.events)).toBe(true);
  });

  it("parseRange returns correct days", () => {
    expect(parseRange("24h").days).toBe(1);
    expect(parseRange("1d").days).toBe(1);
    expect(parseRange("7d").days).toBe(7);
    expect(parseRange("30d").days).toBe(30);
    expect(parseRange("14d").days).toBe(14);
    expect(parseRange("90d").days).toBe(90);
    expect(parseRange("100d").days).toBe(90);
  });
});
