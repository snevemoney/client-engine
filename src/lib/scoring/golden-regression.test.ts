/**
 * Phase 3.6.5: Golden regression integration tests.
 * One test per golden scenario; verifies persistence + API contracts.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { GOLDEN_SCENARIOS, getGoldenScenario } from "./golden-scenarios";
import { runGoldenScenario, restoreGoldenScenarioPreferences } from "./test-utils/run-golden-scenario";

describe("3.6.5 Golden regression", () => {
  beforeEach(async () => {
    await restoreGoldenScenarioPreferences();
  });

  it("golden_healthy_no_event: no score event, no notification, snapshot persists", async () => {
    const r = await runGoldenScenario("golden_healthy_no_event");
    const exp = getGoldenScenario("golden_healthy_no_event")!.expected;

    expect(r.computeResult.score).toBe(exp.score);
    expect(r.computeResult.band).toBe(exp.band);
    expect(r.computeResult.delta).toBe(exp.delta);
    expect(r.computeResult.eventsCreated).toEqual([]);
    expect(r.scoreEvents).toHaveLength(0);
    expect(r.notificationCount).toBe(0);
    expect(r.snapshot).not.toBeNull();
    expect(r.snapshot?.score).toBe(exp.score);
    expect(r.snapshot?.entityId).toContain("golden");
  });

  it("golden_threshold_breach_to_critical: event + notification, payload contract", async () => {
    const r = await runGoldenScenario("golden_threshold_breach_to_critical");
    const exp = getGoldenScenario("golden_threshold_breach_to_critical")!.expected;

    expect(r.computeResult.score).toBe(exp.score);
    expect(r.computeResult.band).toBe(exp.band);
    expect(r.computeResult.delta).toBe(exp.delta);
    expect(r.computeResult.eventsCreated.length).toBeGreaterThanOrEqual(1);
    expect(r.scoreEvents.length).toBeGreaterThanOrEqual(1);

    const breach = r.scoreEvents.find((e) => e.eventType === "threshold_breach");
    expect(breach).toBeDefined();
    if (exp.payloadContract) {
      expect(breach?.fromScore).toBe(exp.payloadContract.fromScore);
      expect(breach?.toScore).toBe(exp.payloadContract.toScore);
      expect(breach?.delta).toBe(exp.payloadContract.delta);
      expect(breach?.fromBand).toBe(exp.payloadContract.fromBand);
      expect(breach?.toBand).toBe(exp.payloadContract.toBand);
      expect(breach?.dedupeKey).toContain(exp.payloadContract.dedupeKeySuffix ?? "threshold_breach");
    }
    expect(r.notificationCount).toBeGreaterThanOrEqual(1);
  });

  it("golden_sharp_drop_notification: sharp_drop event, payload contract", async () => {
    const r = await runGoldenScenario("golden_sharp_drop_notification");
    const exp = getGoldenScenario("golden_sharp_drop_notification")!.expected;

    expect(r.computeResult.score).toBe(exp.score);
    expect(r.computeResult.band).toBe(exp.band);
    expect(r.computeResult.delta).toBe(exp.delta);

    const drop = r.scoreEvents.find((e) => e.eventType === "sharp_drop");
    expect(drop).toBeDefined();
    if (exp.payloadContract) {
      expect(drop?.fromScore).toBe(exp.payloadContract.fromScore);
      expect(drop?.toScore).toBe(exp.payloadContract.toScore);
      expect(drop?.delta).toBe(exp.payloadContract.delta);
      expect(drop?.fromBand).toBe(exp.payloadContract.fromBand);
      expect(drop?.toBand).toBe(exp.payloadContract.toBand);
      expect(drop?.dedupeKey).toContain(exp.payloadContract.dedupeKeySuffix ?? "sharp_drop");
    }
    expect(r.notificationCount).toBeGreaterThanOrEqual(1);
  });

  it("golden_recovery_to_healthy: recovery event, notification", async () => {
    const r = await runGoldenScenario("golden_recovery_to_healthy");
    const exp = getGoldenScenario("golden_recovery_to_healthy")!.expected;

    expect(r.computeResult.score).toBe(exp.score);
    expect(r.computeResult.band).toBe(exp.band);
    expect(r.computeResult.delta).toBe(exp.delta);

    const recovery = r.scoreEvents.find((e) => e.eventType === "recovery");
    expect(recovery).toBeDefined();
    if (exp.payloadContract) {
      expect(recovery?.fromScore).toBe(exp.payloadContract.fromScore);
      expect(recovery?.toScore).toBe(exp.payloadContract.toScore);
      expect(recovery?.fromBand).toBe(exp.payloadContract.fromBand);
      expect(recovery?.toBand).toBe(exp.payloadContract.toBand);
    }
    expect(r.notificationCount).toBeGreaterThanOrEqual(1);
  });

  it("golden_notification_suppressed_by_preferences: event created, no notification", async () => {
    const r = await runGoldenScenario("golden_notification_suppressed_by_preferences");
    const exp = getGoldenScenario("golden_notification_suppressed_by_preferences")!.expected;

    expect(r.computeResult.score).toBe(exp.score);
    expect(r.scoreEvents.length).toBeGreaterThanOrEqual(1);
    expect(r.scoreEvents.some((e) => e.eventType === "threshold_breach")).toBe(true);
    expect(r.notificationCount).toBe(0);
    expect(r.deliveryCount).toBe(0);
  });

  it("golden_notification_suppressed_by_cooldown: event created, no duplicate notification", async () => {
    const r = await runGoldenScenario("golden_notification_suppressed_by_cooldown");
    const exp = getGoldenScenario("golden_notification_suppressed_by_cooldown")!.expected;

    expect(r.computeResult.score).toBe(exp.score);
    expect(r.scoreEvents.length).toBeGreaterThanOrEqual(1);
    expect(r.scoreEvents.some((e) => e.eventType === "threshold_breach")).toBe(true);
    expect(r.notificationCount).toBe(1);
  });

  it("all golden scenarios execute without unexpected exceptions", async () => {
    for (const scenario of GOLDEN_SCENARIOS) {
      await expect(runGoldenScenario(scenario.id)).resolves.toBeDefined();
      await restoreGoldenScenarioPreferences();
    }
  });
});
