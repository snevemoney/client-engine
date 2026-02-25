/**
 * Phase 3.5: Unit tests for score notification cooldown.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { isScoreNotificationInCooldown } from "./notification-cooldown";

const SCOPE = { entityType: "command_center", entityId: "command_center", eventType: "sharp_drop" as const };

describe("isScoreNotificationInCooldown", () => {
  beforeEach(async () => {
    await db.notificationEvent.deleteMany({
      where: {
        sourceType: "score",
        eventKey: "score.sharp_drop",
      },
    });
  });

  it("cooldown disabled (0) -> no suppression", async () => {
    const result = await isScoreNotificationInCooldown(
      SCOPE.entityType,
      SCOPE.entityId,
      SCOPE.eventType,
      0
    );
    expect(result.inCooldown).toBe(false);
  });

  it("cooldown active with recent matching notification -> suppress", async () => {
    const dedupeKey = `notif:score:${SCOPE.entityType}:${SCOPE.entityId}:${SCOPE.eventType}`;
    await db.notificationEvent.create({
      data: {
        eventKey: "score.sharp_drop",
        title: "Test",
        message: "Test",
        severity: "warning",
        sourceType: "score",
        sourceId: "test",
        dedupeKey,
        status: "sent",
        occurredAt: new Date(),
      },
    });

    const result = await isScoreNotificationInCooldown(
      SCOPE.entityType,
      SCOPE.entityId,
      SCOPE.eventType,
      60
    );
    expect(result.inCooldown).toBe(true);
    expect(result.lastNotificationAt).toBeDefined();
  });

  it("cooldown active but different eventType -> allow", async () => {
    await db.notificationEvent.create({
      data: {
        eventKey: "score.sharp_drop",
        title: "Test",
        message: "Test",
        severity: "warning",
        sourceType: "score",
        sourceId: "test",
        dedupeKey: `notif:score:${SCOPE.entityType}:${SCOPE.entityId}:sharp_drop`,
        status: "sent",
        occurredAt: new Date(),
      },
    });

    const result = await isScoreNotificationInCooldown(
      SCOPE.entityType,
      SCOPE.entityId,
      "threshold_breach",
      60
    );
    expect(result.inCooldown).toBe(false);
  });

  it("cooldown active but different entity -> allow", async () => {
    await db.notificationEvent.create({
      data: {
        eventKey: "score.sharp_drop",
        title: "Test",
        message: "Test",
        severity: "warning",
        sourceType: "score",
        sourceId: "test",
        dedupeKey: `notif:score:command_center:command_center:sharp_drop`,
        status: "sent",
        occurredAt: new Date(),
      },
    });

    const result = await isScoreNotificationInCooldown(
      "review_stream",
      "2025-01-06",
      "sharp_drop",
      60
    );
    expect(result.inCooldown).toBe(false);
  });

  it("no matching notification within window -> allow", async () => {
    const result = await isScoreNotificationInCooldown(
      "no_match_entity",
      "no_match_id",
      "recovery",
      60
    );
    expect(result.inCooldown).toBe(false);
  });
});
