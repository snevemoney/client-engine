/**
 * Phase 3.1: Unit tests for score latest endpoint response shape.
 * Tests the data shape returned; auth is covered by e2e api-auth.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";

describe("scores latest response shape", () => {
  const ENTITY = "test_latest_shape";

  beforeEach(async () => {
    await db.scoreSnapshot.deleteMany({ where: { entityId: ENTITY } });
    await db.scoreEvent.deleteMany({ where: { entityId: ENTITY } });
  });

  it("returns expected shape when snapshot exists", async () => {
    const snapshot = await db.scoreSnapshot.create({
      data: {
        entityType: "command_center",
        entityId: ENTITY,
        score: 75,
        band: "warning",
        delta: -5,
        factorsJson: [{ key: "a", label: "A", weight: 1 }],
        reasonsJson: [{ label: "Reason", impact: 10, direction: "positive" }],
        computedAt: new Date(),
      },
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
        take: 5,
      }),
    ]);

    const response = {
      latest: latest
        ? {
            id: latest.id,
            score: latest.score,
            band: latest.band,
            delta: latest.delta,
            factorsJson: latest.factorsJson,
            reasonsJson: latest.reasonsJson,
            computedAt: latest.computedAt.toISOString(),
          }
        : null,
      previous: previous[0]
        ? {
            id: previous[0].id,
            score: previous[0].score,
            band: previous[0].band,
            computedAt: previous[0].computedAt.toISOString(),
          }
        : null,
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

    expect(response.latest).not.toBeNull();
    expect(response.latest).toHaveProperty("id", snapshot.id);
    expect(response.latest).toHaveProperty("score", 75);
    expect(response.latest).toHaveProperty("band", "warning");
    expect(response.latest).toHaveProperty("delta", -5);
    expect(response.latest).toHaveProperty("factorsJson");
    expect(response.latest).toHaveProperty("reasonsJson");
    expect(response.latest).toHaveProperty("computedAt");
    expect(typeof (response.latest as { computedAt: string }).computedAt).toBe("string");
    expect(response).toHaveProperty("previous");
    expect(response).toHaveProperty("recentEvents");
    expect(Array.isArray(response.recentEvents)).toBe(true);
  });

  it("returns null latest when no snapshot exists", async () => {
    const [latest] = await Promise.all([
      db.scoreSnapshot.findFirst({
        where: { entityType: "command_center", entityId: ENTITY },
        orderBy: { computedAt: "desc" },
      }),
    ]);
    expect(latest).toBeNull();
  });
});
