/**
 * Phase 3.1: Unit tests for score compute endpoint response shape.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { computeAndStoreScore } from "@/lib/scoring/compute-and-store";

const ENTITY = "test_compute_shape";

describe("scores compute response shape", () => {
  beforeEach(async () => {
    await db.scoreSnapshot.deleteMany({ where: { entityId: ENTITY } });
    await db.scoreEvent.deleteMany({ where: { entityId: ENTITY } });
  });

  it("returns snapshotId, score, band, delta, eventsCreated", async () => {
    const result = await computeAndStoreScore("command_center", ENTITY, {
      _testOverride: { score: 70, band: "warning" },
    });

    const response = {
      snapshotId: result.snapshotId,
      score: result.score,
      band: result.band,
      delta: result.delta,
      eventsCreated: result.eventsCreated,
    };

    expect(response).toHaveProperty("snapshotId");
    expect(typeof response.snapshotId).toBe("string");
    expect(response.snapshotId.length).toBeGreaterThan(0);
    expect(response).toHaveProperty("score", 70);
    expect(response).toHaveProperty("band", "warning");
    expect(response).toHaveProperty("delta");
    expect(response).toHaveProperty("eventsCreated");
    expect(Array.isArray(response.eventsCreated)).toBe(true);
  });

  it("returns eventsCreated when events are triggered", async () => {
    await computeAndStoreScore("command_center", ENTITY, {
      _testOverride: { score: 60, band: "warning" },
    });
    const result = await computeAndStoreScore("command_center", ENTITY, {
      _testOverride: { score: 40, band: "critical" },
    });
    expect(result.eventsCreated.length).toBeGreaterThanOrEqual(1);
  });
});
