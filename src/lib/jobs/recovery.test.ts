/**
 * Phase 2.8.5: Recovery tests.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { enqueueJob } from "./enqueue";
import { claimNextJobs } from "./claim";
import { recoverStaleRunningJobs } from "./recovery";
import { JobRunStatus } from "@prisma/client";

describe("recoverStaleRunningJobs", () => {
  beforeEach(async () => {
    await db.jobRun.deleteMany({});
  });

  it("requeues stale running job when attempts < maxAttempts", async () => {
    const r = await enqueueJob({ jobType: "run_reminder_rules" });
    const claimed = await claimNextJobs({ limit: 1, runnerId: "test" });
    expect(claimed.length).toBe(1);

    const staleThreshold = new Date(Date.now() - 15 * 60 * 1000);
    await db.jobRun.update({
      where: { id: r.id },
      data: { lockedAt: staleThreshold, startedAt: staleThreshold },
    });

    const result = await recoverStaleRunningJobs({ staleAfterMinutes: 10 });
    expect(result.count).toBe(1);
    expect(result.requeued).toBe(1);
    expect(result.deadLettered).toBe(0);

    const job = await db.jobRun.findUnique({ where: { id: r.id } });
    expect(job?.status).toBe(JobRunStatus.queued);
    expect(job?.lockedAt).toBeNull();
  });

  it("dead-letters stale job at maxAttempts", async () => {
    const r = await enqueueJob({ jobType: "run_reminder_rules" });
    await db.jobRun.update({
      where: { id: r.id },
      data: {
        status: JobRunStatus.running,
        lockedAt: new Date(Date.now() - 15 * 60 * 1000),
        startedAt: new Date(Date.now() - 15 * 60 * 1000),
        attempts: 3,
        maxAttempts: 3,
      },
    });

    const result = await recoverStaleRunningJobs({ staleAfterMinutes: 10 });
    expect(result.count).toBe(1);
    expect(result.requeued).toBe(0);
    expect(result.deadLettered).toBe(1);

    const job = await db.jobRun.findUnique({ where: { id: r.id } });
    expect(job?.status).toBe(JobRunStatus.dead_letter);
  });
});
