/**
 * Unit tests for getMetricsSummary — empty DB and shape validation (Validation Matrix #33).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { getMetricsSummary } from "./metrics";

describe("getMetricsSummary", () => {
  beforeEach(async () => {
    await db.notificationEvent.deleteMany({});
    await db.notificationDelivery.deleteMany({});
    await db.inAppNotification.deleteMany({});
  });

  it("returns zero values and valid shape when DB has no notification data (empty DB)", async () => {
    const summary = await getMetricsSummary("24h");

    expect(summary.period).toBe("24h");
    expect(summary.notifications.totalCreated).toBe(0);
    expect(summary.notifications.inAppRead).toBe(0);
    expect(summary.notifications.inAppUnread).toBe(0);
    expect(typeof summary.notifications.bySourceType).toBe("object");
    expect(typeof summary.notifications.byEventKey).toBe("object");
    expect(typeof summary.notifications.bySeverity).toBe("object");

    expect(summary.deliveries.attempted).toBe(0);
    expect(summary.deliveries.succeeded).toBe(0);
    expect(summary.deliveries.failed).toBe(0);
    expect(summary.deliveries.skipped).toBe(0);
    expect(summary.deliveries.retried).toBe(0);
    expect(typeof summary.deliveries.avgLatencyMs).toBe("object");
    expect(typeof summary.deliveries.byChannel).toBe("object");

    expect(typeof summary.escalations.rulesTriggered).toBe("number");
    expect(typeof summary.escalations.eventsCreated).toBe("number");
    expect(typeof summary.escalations.dedupedSuppressed).toBe("number");

    expect(typeof summary.jobs.staleRunning).toBe("number");
    expect(Number.isFinite(summary.jobs.staleRunning)).toBe(true);
  });

  it("returns same shape for 7d period", async () => {
    const summary = await getMetricsSummary("7d");
    expect(summary.period).toBe("7d");
    expect(summary.notifications.totalCreated).toBe(0);
  });
});
