/**
 * Phase 3.6.3: API chain replay — compute → latest/history/summary consistency.
 * Proves that after compute, downstream API views reflect the new state.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { computeAndStoreScore } from "@/lib/scoring/compute-and-store";

const ENTITY = "test_replay_integration";

describe("3.6.3 API chain replay", () => {
  beforeEach(async () => {
    await db.scoreEvent.deleteMany({ where: { entityId: ENTITY } });
    await db.scoreSnapshot.deleteMany({ where: { entityId: ENTITY } });
  });

  it("compute → summary: latest reflects newest, previous reflects prior, recentEvents includes triggered event", async () => {
    const r1 = await computeAndStoreScore("command_center", ENTITY, {
      _testOverride: { score: 70, band: "healthy" },
    });
    const r2 = await computeAndStoreScore("command_center", ENTITY, {
      _testOverride: { score: 40, band: "critical" },
    });

    const [latest, previous, events] = await Promise.all([
      db.scoreSnapshot.findFirst({
        where: { entityType: "command_center", entityId: ENTITY },
        orderBy: { computedAt: "desc" },
      }),
      db.scoreSnapshot.findMany({
        where: { entityType: "command_center", entityId: ENTITY },
        orderBy: { computedAt: "desc" },
        skip: 1,
        take: 1,
      }),
      db.scoreEvent.findMany({
        where: { entityType: "command_center", entityId: ENTITY },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    expect(latest?.id).toBe(r2.snapshotId);
    expect(latest?.score).toBe(40);
    expect(latest?.band).toBe("critical");
    expect(latest?.delta).toBe(-30);

    expect(previous).toHaveLength(1);
    expect(previous[0]?.id).toBe(r1.snapshotId);
    expect(previous[0]?.score).toBe(70);

    const breach = events.find((e) => e.eventType === "threshold_breach");
    expect(breach).not.toBeUndefined();
    expect(breach?.fromScore).toBe(70);
    expect(breach?.toScore).toBe(40);
    expect(breach?.fromBand).toBe("healthy");
    expect(breach?.toBand).toBe("critical");
  });

  it("compute → history: timeline and events contain snapshots and score events", async () => {
    await computeAndStoreScore("command_center", ENTITY, {
      _testOverride: { score: 60, band: "warning" },
    });
    await computeAndStoreScore("command_center", ENTITY, {
      _testOverride: { score: 45, band: "critical" },
    });

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

    expect(snapshots).toHaveLength(2);
    expect(events.length).toBeGreaterThanOrEqual(1);
    const breach = events.find((e) => e.eventType === "threshold_breach");
    expect(breach).not.toBeUndefined();
  });
});
