/**
 * Phase 2.8.4: Claim tests.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { enqueueJob } from "./enqueue";
import { claimNextJobs } from "./claim";

describe("claimNextJobs", () => {
  beforeEach(async () => {
    await db.jobRun.deleteMany({});
  });

  it("claims eligible queued jobs", async () => {
    const { id } = await enqueueJob({ jobType: "run_reminder_rules" });
    await db.jobRun.update({ where: { id }, data: { runAfter: new Date(0) } });
    const claimed = await claimNextJobs({ limit: 5, runnerId: "test-runner" });
    expect(claimed.length).toBe(1);
    expect(claimed[0]!.jobType).toBe("run_reminder_rules");
    expect(claimed[0]!.attempts).toBe(1);

    const job = await db.jobRun.findFirst({ where: { jobType: "run_reminder_rules" } });
    expect(job?.status).toBe("running");
    expect(job?.lockOwner).toBe("test-runner");
    expect(job?.attempts).toBe(1);
  });

  it("skips future runAfter jobs", async () => {
    const result = await enqueueJob({ jobType: "run_reminder_rules" });
    await db.jobRun.update({
      where: { id: result.id },
      data: { runAfter: new Date(Date.now() + 60_000) },
    });

    const claimed = await claimNextJobs({ limit: 5, runnerId: "test-runner" });
    expect(claimed.length).toBe(0);
  });

  it("marks running, lockOwner, attempts", async () => {
    const { id } = await enqueueJob({ jobType: "capture_metrics_snapshot" });
    await db.jobRun.update({
      where: { id },
      data: { runAfter: new Date(0) },
    });
    const claimed = await claimNextJobs({ limit: 5, runnerId: "runner-xyz" });

    expect(claimed.length).toBe(1);
    const job = await db.jobRun.findFirst({ where: { jobType: "capture_metrics_snapshot" } });
    expect(job?.status).toBe("running");
    expect(job?.lockOwner).toBe("runner-xyz");
    expect(job?.lockedAt).toBeDefined();
    expect(job?.startedAt).toBeDefined();
    expect(job?.attempts).toBe(1);
  });
});
