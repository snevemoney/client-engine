/**
 * Phase 4.2: Delivery actions unit tests.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { NextActionPriority, NextActionStatus, RiskSourceType } from "@prisma/client";
import { runDeliveryAction, DELIVERY_ACTIONS } from "./delivery-actions";

describe("delivery-actions", () => {
  beforeEach(async () => {
    await db.nextActionExecution.deleteMany({});
    await db.nextBestAction.deleteMany({ where: { createdByRule: "test_delivery" } });
  });

  it("exports all 6 MVP actions", () => {
    expect(DELIVERY_ACTIONS.mark_done).toBeDefined();
    expect(DELIVERY_ACTIONS.snooze_1d).toBeDefined();
    expect(DELIVERY_ACTIONS.recompute_score).toBeDefined();
    expect(DELIVERY_ACTIONS.run_risk_rules).toBeDefined();
    expect(DELIVERY_ACTIONS.run_next_actions).toBeDefined();
    expect(DELIVERY_ACTIONS.retry_failed_deliveries).toBeDefined();
  });

  it("runDeliveryAction returns unknown_action for invalid key", async () => {
    const a = await db.nextBestAction.create({
      data: {
        title: "Test",
        priority: NextActionPriority.high,
        score: 50,
        status: NextActionStatus.queued,
        sourceType: RiskSourceType.proposal,
        dedupeKey: `test_delivery_unknown:${Date.now()}`,
        createdByRule: "test_delivery",
      },
    });
    const result = await runDeliveryAction({
      nextActionId: a.id,
      actionKey: "invalid",
      actorUserId: "u1",
    });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("unknown_action");
  });

  it("runDeliveryAction returns not_found for missing NBA", async () => {
    const result = await runDeliveryAction({
      nextActionId: "nonexistent_123",
      actionKey: "mark_done",
      actorUserId: "u1",
    });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("not_found");
  });

  it("mark_done completes NBA and creates execution record", async () => {
    const a = await db.nextBestAction.create({
      data: {
        title: "Test",
        priority: NextActionPriority.high,
        score: 50,
        status: NextActionStatus.queued,
        sourceType: RiskSourceType.proposal,
        dedupeKey: `test_delivery_mark:${Date.now()}`,
        createdByRule: "test_delivery",
      },
    });
    const result = await runDeliveryAction({
      nextActionId: a.id,
      actionKey: "mark_done",
      actorUserId: "u1",
    });
    expect(result.ok).toBe(true);
    expect(result.executionId).toBeDefined();

    const updated = await db.nextBestAction.findUnique({ where: { id: a.id } });
    expect(updated?.status).toBe(NextActionStatus.done);
    expect(updated?.lastExecutionStatus).toBe("success");

    const exec = await db.nextActionExecution.findFirst({
      where: { nextActionId: a.id, actionKey: "mark_done" },
    });
    expect(exec?.status).toBe("success");
  });

  it("snooze_1d sets snoozedUntil", async () => {
    const a = await db.nextBestAction.create({
      data: {
        title: "Test",
        priority: NextActionPriority.high,
        score: 50,
        status: NextActionStatus.queued,
        sourceType: RiskSourceType.proposal,
        dedupeKey: `test_delivery_snooze:${Date.now()}`,
        createdByRule: "test_delivery",
      },
    });
    const result = await runDeliveryAction({
      nextActionId: a.id,
      actionKey: "snooze_1d",
      actorUserId: "u1",
    });
    expect(result.ok).toBe(true);

    const updated = await db.nextBestAction.findUnique({ where: { id: a.id } });
    expect(updated?.snoozedUntil).toBeDefined();
    const until = updated!.snoozedUntil!;
    expect(until.getTime()).toBeGreaterThan(Date.now());
  });
});
