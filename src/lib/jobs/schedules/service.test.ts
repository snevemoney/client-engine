/**
 * Phase 2.8.5: Schedule service tests.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { createSchedule, enqueueDueSchedules, listSchedules } from "./service";

describe("schedule service", () => {
  beforeEach(async () => {
    await db.jobSchedule.deleteMany({});
    await db.jobRun.deleteMany({});
  });

  it("createSchedule creates and computes nextRunAt", async () => {
    const s = await createSchedule({
      key: "test_daily",
      title: "Test Daily",
      jobType: "run_reminder_rules",
      cadenceType: "daily",
      hour: 9,
      minute: 0,
      isEnabled: true,
    });
    expect(s.key).toBe("test_daily");
    expect(s.nextRunAt).toBeDefined();
    expect(s.isEnabled).toBe(true);
  });

  it("enqueueDueSchedules enqueues due enabled schedules", async () => {
    await createSchedule({
      key: "test_interval",
      title: "Test Interval",
      jobType: "run_reminder_rules",
      cadenceType: "interval",
      intervalMinutes: 1,
      isEnabled: true,
    });
    await db.jobSchedule.updateMany({
      where: { key: "test_interval" },
      data: { nextRunAt: new Date(0) },
    });
    const result = await enqueueDueSchedules({ now: new Date(), limit: 10 });
    expect(result.dueSchedules).toBeGreaterThanOrEqual(1);
    expect(result.jobsEnqueued).toBeGreaterThanOrEqual(1);
  });

  it("disabled schedules skipped", async () => {
    await createSchedule({
      key: "test_disabled",
      title: "Test Disabled",
      jobType: "run_reminder_rules",
      cadenceType: "daily",
      hour: 9,
      minute: 0,
      isEnabled: false,
    });
    await db.jobSchedule.updateMany({
      where: { key: "test_disabled" },
      data: { nextRunAt: new Date(0) },
    });
    const result = await enqueueDueSchedules({ now: new Date(), limit: 10 });
    expect(result.dueSchedules).toBe(0);
  });

  it("listSchedules returns all", async () => {
    await createSchedule({
      key: "list_a",
      title: "A",
      jobType: "run_reminder_rules",
      cadenceType: "daily",
      hour: 9,
      minute: 0,
    });
    const items = await listSchedules();
    expect(items.length).toBeGreaterThanOrEqual(1);
  });
});
