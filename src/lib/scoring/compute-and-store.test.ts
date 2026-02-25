import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { computeAndStoreScore } from "./compute-and-store";
import { updateScoreAlertsPreferences } from "@/lib/scores/alerts-preferences";
import * as notificationService from "@/lib/notifications/service";

const TEST_ENTITY = "test_entity_phase31";


describe("computeAndStoreScore", () => {
  beforeEach(async () => {
    await db.scoreEvent.deleteMany({ where: { entityId: TEST_ENTITY } });
    await db.scoreSnapshot.deleteMany({ where: { entityId: TEST_ENTITY } });
    await db.scoreEvent.deleteMany({ where: { entityId: "command_center" } });
    await db.scoreSnapshot.deleteMany({ where: { entityId: "command_center" } });
  });

  it("creates snapshot for command_center", async () => {
    const result = await computeAndStoreScore("command_center", "command_center");
    expect(result.snapshotId).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(["healthy", "warning", "critical"]).toContain(result.band);
    expect(result.delta).toBeNull();
    expect(Array.isArray(result.eventsCreated)).toBe(true);

    const snapshot = await db.scoreSnapshot.findUnique({
      where: { id: result.snapshotId },
    });
    expect(snapshot).not.toBeNull();
    expect(snapshot?.entityType).toBe("command_center");
    expect(snapshot?.entityId).toBe("command_center");
  });

  it("computes delta when previous snapshot exists", async () => {
    await computeAndStoreScore("command_center", "command_center");
    const result = await computeAndStoreScore("command_center", "command_center");
    expect(result.delta).not.toBeNull();
    expect(typeof result.delta).toBe("number");
  });

  it("stores delta as current - previous score", async () => {
    await computeAndStoreScore("command_center", TEST_ENTITY, {
      _testOverride: { score: 60, band: "warning" },
    });
    const result = await computeAndStoreScore("command_center", TEST_ENTITY, {
      _testOverride: { score: 45, band: "critical" },
    });
    expect(result.delta).toBe(-15);
  });

  it("persists factorsJson and reasonsJson", async () => {
    const result = await computeAndStoreScore("command_center", "command_center");
    const snapshot = await db.scoreSnapshot.findUnique({
      where: { id: result.snapshotId },
    });
    expect(snapshot?.factorsJson).toBeDefined();
    expect(snapshot?.reasonsJson).toBeDefined();
    expect(Array.isArray(snapshot?.factorsJson)).toBe(true);
    expect(Array.isArray(snapshot?.reasonsJson)).toBe(true);
  });

  it("handles review_stream with missing week gracefully", async () => {
    const result = await computeAndStoreScore(
      "review_stream",
      "2099-01-06"
    );
    expect(result.snapshotId).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("3.6.3 normal recompute: snapshot persisted, no score event when no threshold crossing", async () => {
    const r1 = await computeAndStoreScore("command_center", TEST_ENTITY, {
      _testOverride: { score: 70, band: "healthy" },
    });
    const r2 = await computeAndStoreScore("command_center", TEST_ENTITY, {
      _testOverride: { score: 72, band: "healthy" },
    });
    expect(r2.snapshotId).toBeDefined();
    expect(r2.delta).toBe(2);
    expect(r2.eventsCreated).toEqual([]);
    const eventCount = await db.scoreEvent.count({ where: { entityId: TEST_ENTITY } });
    expect(eventCount).toBe(0);
  });
});

describe("score events", () => {
  beforeEach(async () => {
    await db.scoreEvent.deleteMany({ where: { entityId: TEST_ENTITY } });
    await db.scoreSnapshot.deleteMany({ where: { entityId: TEST_ENTITY } });
    await db.notificationEvent.deleteMany({ where: { sourceType: "score" } });
  });

  it("creates threshold_breach event when band crosses into critical", async () => {
    await computeAndStoreScore("command_center", TEST_ENTITY, {
      _testOverride: { score: 60, band: "warning" },
    });
    const result = await computeAndStoreScore("command_center", TEST_ENTITY, {
      _testOverride: { score: 40, band: "critical" },
    });
    expect(result.eventsCreated.length).toBeGreaterThanOrEqual(1);
    const breach = await db.scoreEvent.findFirst({
      where: { entityId: TEST_ENTITY, eventType: "threshold_breach" },
    });
    expect(breach).not.toBeNull();
    expect(breach?.fromBand).toBe("warning");
    expect(breach?.toBand).toBe("critical");
  });

  it("creates sharp_drop event when delta <= -15", async () => {
    await computeAndStoreScore("command_center", TEST_ENTITY, {
      _testOverride: { score: 85, band: "healthy" },
    });
    const result = await computeAndStoreScore("command_center", TEST_ENTITY, {
      _testOverride: { score: 65, band: "warning" },
    });
    expect(result.eventsCreated.length).toBeGreaterThanOrEqual(1);
    const drop = await db.scoreEvent.findFirst({
      where: { entityId: TEST_ENTITY, eventType: "sharp_drop" },
    });
    expect(drop).not.toBeNull();
    expect(drop?.delta).toBeLessThanOrEqual(-15);
  });

  it("3.6.3 sharp_drop: full payload fromScore, toScore, delta, bands, dedupeKey", async () => {
    await computeAndStoreScore("command_center", TEST_ENTITY, {
      _testOverride: { score: 85, band: "healthy" },
    });
    await computeAndStoreScore("command_center", TEST_ENTITY, {
      _testOverride: { score: 65, band: "warning" },
    });
    const drop = await db.scoreEvent.findFirst({
      where: { entityId: TEST_ENTITY, eventType: "sharp_drop" },
    });
    expect(drop).not.toBeNull();
    expect(drop?.fromScore).toBe(85);
    expect(drop?.toScore).toBe(65);
    expect(drop?.delta).toBe(-20);
    expect(drop?.fromBand).toBe("healthy");
    expect(drop?.toBand).toBe("warning");
    expect(drop?.dedupeKey).toBe(`score:command_center:${TEST_ENTITY}:sharp_drop`);
  });

  it("creates recovery event when band crosses to healthy", async () => {
    await computeAndStoreScore("command_center", TEST_ENTITY, {
      _testOverride: { score: 45, band: "critical" },
    });
    const result = await computeAndStoreScore("command_center", TEST_ENTITY, {
      _testOverride: { score: 85, band: "healthy" },
    });
    expect(result.eventsCreated.length).toBeGreaterThanOrEqual(1);
    const recovery = await db.scoreEvent.findFirst({
      where: { entityId: TEST_ENTITY, eventType: "recovery" },
    });
    expect(recovery).not.toBeNull();
    expect(recovery?.fromBand).not.toBe("healthy");
    expect(recovery?.toBand).toBe("healthy");
  });

  it("3.6.3 recovery: full payload fromScore, toScore, delta, bands", async () => {
    await computeAndStoreScore("command_center", TEST_ENTITY, {
      _testOverride: { score: 40, band: "critical" },
    });
    await computeAndStoreScore("command_center", TEST_ENTITY, {
      _testOverride: { score: 85, band: "healthy" },
    });
    const rec = await db.scoreEvent.findFirst({
      where: { entityId: TEST_ENTITY, eventType: "recovery" },
    });
    expect(rec).not.toBeNull();
    expect(rec?.fromScore).toBe(40);
    expect(rec?.toScore).toBe(85);
    expect(rec?.delta).toBe(45);
    expect(rec?.fromBand).toBe("critical");
    expect(rec?.toBand).toBe("healthy");
  });

  it("does not create duplicate event within dedupe window", async () => {
    await computeAndStoreScore("command_center", TEST_ENTITY, {
      _testOverride: { score: 60, band: "warning" },
    });
    await computeAndStoreScore("command_center", TEST_ENTITY, {
      _testOverride: { score: 40, band: "critical" },
    });
    const count1 = await db.scoreEvent.count({
      where: { entityId: TEST_ENTITY, eventType: "threshold_breach" },
    });
    await computeAndStoreScore("command_center", TEST_ENTITY, {
      _testOverride: { score: 35, band: "critical" },
    });
    const count2 = await db.scoreEvent.count({
      where: { entityId: TEST_ENTITY, eventType: "threshold_breach" },
    });
    expect(count2).toBe(count1);
  });
});

describe("score notification integration", () => {
  beforeEach(async () => {
    await db.scoreEvent.deleteMany({ where: { entityId: TEST_ENTITY } });
    await db.scoreSnapshot.deleteMany({ where: { entityId: TEST_ENTITY } });
    await db.notificationEvent.deleteMany({ where: { sourceType: "score" } });
    await updateScoreAlertsPreferences({ enabled: true, events: { threshold_breach: true, sharp_drop: true, recovery: true } });
  });

  it("creates notification event with expected payload shape", async () => {
    await computeAndStoreScore("command_center", TEST_ENTITY, {
      _testOverride: { score: 60, band: "warning" },
    });
    await computeAndStoreScore("command_center", TEST_ENTITY, {
      _testOverride: { score: 40, band: "critical" },
    });
    const notif = await db.notificationEvent.findFirst({
      where: { sourceType: "score", eventKey: "score.threshold_breach" },
      orderBy: { createdAt: "desc" },
    });
    expect(notif).not.toBeNull();
    const meta = notif?.metaJson as Record<string, unknown>;
    expect(meta).toHaveProperty("entityType", "command_center");
    expect(meta).toHaveProperty("entityId", TEST_ENTITY);
    expect(meta).toHaveProperty("fromScore", 60);
    expect(meta).toHaveProperty("toScore", 40);
    expect(meta).toHaveProperty("delta", -20);
    expect(meta).toHaveProperty("fromBand", "warning");
    expect(meta).toHaveProperty("toBand", "critical");
    expect(meta).toHaveProperty("topReasons");
  });

  it("score event still created when notification suppressed by preferences", async () => {
    await updateScoreAlertsPreferences({ enabled: false });
    try {
      await computeAndStoreScore("command_center", TEST_ENTITY, {
        _testOverride: { score: 60, band: "warning" },
      });
      await computeAndStoreScore("command_center", TEST_ENTITY, {
        _testOverride: { score: 40, band: "critical" },
      });
      const breachEvent = await db.scoreEvent.findFirst({
        where: { entityId: TEST_ENTITY, eventType: "threshold_breach" },
      });
      expect(breachEvent).not.toBeNull();
      const notifCount = await db.notificationEvent.count({
        where: { sourceType: "score", eventKey: "score.threshold_breach" },
      });
      expect(notifCount).toBe(0);
    } finally {
      await updateScoreAlertsPreferences({ enabled: true });
    }
  });

  it("3.6.4 resilience: score event and snapshot persist when notification delivery fails", async () => {
    const original = notificationService.queueNotificationDeliveries;
    vi.spyOn(notificationService, "queueNotificationDeliveries").mockRejectedValueOnce(
      new Error("Simulated delivery failure")
    );
    try {
      await computeAndStoreScore("command_center", TEST_ENTITY, {
        _testOverride: { score: 60, band: "warning" },
      });
      await expect(
        computeAndStoreScore("command_center", TEST_ENTITY, {
          _testOverride: { score: 40, band: "critical" },
        })
      ).rejects.toThrow("Simulated delivery failure");

      const breach = await db.scoreEvent.findFirst({
        where: { entityId: TEST_ENTITY, eventType: "threshold_breach" },
      });
      expect(breach).not.toBeNull();
      expect(breach?.fromBand).toBe("warning");
      expect(breach?.toBand).toBe("critical");

      const snapshotCount = await db.scoreSnapshot.count({
        where: { entityId: TEST_ENTITY },
      });
      expect(snapshotCount).toBe(2);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("3.6.3 event persistence contract: score events always stored even when notifications suppressed", async () => {
    await updateScoreAlertsPreferences({ enabled: false, events: { threshold_breach: false } });
    try {
      await computeAndStoreScore("command_center", TEST_ENTITY, {
        _testOverride: { score: 60, band: "warning" },
      });
      await computeAndStoreScore("command_center", TEST_ENTITY, {
        _testOverride: { score: 40, band: "critical" },
      });
      const breach = await db.scoreEvent.findFirst({
        where: { entityId: TEST_ENTITY, eventType: "threshold_breach" },
      });
      expect(breach).not.toBeNull();
      const notifs = await db.notificationEvent.count({ where: { sourceType: "score" } });
      expect(notifs).toBe(0);
    } finally {
      await updateScoreAlertsPreferences({ enabled: true });
    }
  });

  it("cooldown suppresses notification when prior notification exists within window", async () => {
    const dedupeKey = `notif:score:command_center:${TEST_ENTITY}:threshold_breach`;
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
    await updateScoreAlertsPreferences({ cooldownMinutes: 60 });
    try {
      await computeAndStoreScore("command_center", TEST_ENTITY, {
        _testOverride: { score: 60, band: "warning" },
      });
      await computeAndStoreScore("command_center", TEST_ENTITY, {
        _testOverride: { score: 40, band: "critical" },
      });
      const breachEventCount = await db.scoreEvent.count({
        where: { entityId: TEST_ENTITY, eventType: "threshold_breach" },
      });
      expect(breachEventCount).toBe(1);
      const notifCount = await db.notificationEvent.count({
        where: { sourceType: "score", eventKey: "score.threshold_breach" },
      });
      expect(notifCount).toBe(1);
    } finally {
      await updateScoreAlertsPreferences({ cooldownMinutes: 60 });
    }
  });

  it("dedupe prevents repeated notifications for same event", async () => {
    await computeAndStoreScore("command_center", TEST_ENTITY, {
      _testOverride: { score: 60, band: "warning" },
    });
    await computeAndStoreScore("command_center", TEST_ENTITY, {
      _testOverride: { score: 40, band: "critical" },
    });
    const count1 = await db.notificationEvent.count({
      where: { sourceType: "score", eventKey: "score.threshold_breach" },
    });
    await computeAndStoreScore("command_center", TEST_ENTITY, {
      _testOverride: { score: 35, band: "critical" },
    });
    const count2 = await db.notificationEvent.count({
      where: { sourceType: "score", eventKey: "score.threshold_breach" },
    });
    expect(count2).toBe(count1);
  });

  it("rapid repeated recompute: snapshots created, cooldown/dedupe suppress notifications", async () => {
    await updateScoreAlertsPreferences({ enabled: true, cooldownMinutes: 60 });
    const results: Awaited<ReturnType<typeof computeAndStoreScore>>[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await computeAndStoreScore("command_center", TEST_ENTITY, {
        _testOverride: { score: 40 + i * 2, band: i < 2 ? "critical" : "warning" },
      });
      results.push(r);
    }
    const snapshotCount = await db.scoreSnapshot.count({
      where: { entityId: TEST_ENTITY },
    });
    expect(snapshotCount).toBe(5);
    const notifCount = await db.notificationEvent.count({
      where: { sourceType: "score" },
    });
    expect(notifCount).toBeLessThanOrEqual(3);
  });

  it("3.6.4 recompute after delivery failure: next recompute succeeds, valid snapshot", async () => {
    const spy = vi.spyOn(notificationService, "queueNotificationDeliveries");
    spy.mockRejectedValueOnce(new Error("Simulated delivery failure"));
    try {
      await computeAndStoreScore("command_center", TEST_ENTITY, {
        _testOverride: { score: 60, band: "warning" },
      });
      await expect(
        computeAndStoreScore("command_center", TEST_ENTITY, {
          _testOverride: { score: 40, band: "critical" },
        })
      ).rejects.toThrow("Simulated delivery failure");

      spy.mockRestore();
      const r = await computeAndStoreScore("command_center", TEST_ENTITY, {
        _testOverride: { score: 75, band: "healthy" },
      });
      expect(r.snapshotId).toBeDefined();
      expect(r.score).toBe(75);
      expect(r.band).toBe("healthy");
      const snap = await db.scoreSnapshot.findUnique({
        where: { id: r.snapshotId },
      });
      expect(snap).not.toBeNull();
      expect(snap?.score).toBe(75);
    } finally {
      vi.restoreAllMocks();
    }
  });
});

describe("score notification payload", () => {
  it("meta shape is log-safe (no secrets)", async () => {
    const { sanitizeNotificationMeta } = await import("@/lib/notifications/sanitize");
    const meta = {
      entityType: "command_center",
      entityId: "command_center",
      fromScore: 70,
      toScore: 45,
      delta: -25,
      fromBand: "warning",
      toBand: "critical",
      topReasons: ["Followups overdue", "Job health"],
    };
    const out = sanitizeNotificationMeta(meta);
    expect(out).not.toBeNull();
    expect(out?.entityType).toBe("command_center");
    expect(out?.fromScore).toBe(70);
    expect(out?.toScore).toBe(45);
    expect(out?.delta).toBe(-25);
    expect(out?.topReasons).toEqual(["Followups overdue", "Job health"]);
    expect(JSON.stringify(out)).not.toContain("[redacted]");
  });
});
