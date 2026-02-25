/**
 * Phase 2.8.4: Runner tests.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { enqueueJob } from "./enqueue";
import { runJobsLoopOnce } from "./runner";

describe("runJobsLoopOnce", () => {
  beforeEach(async () => {
    await db.jobRun.deleteMany({});
  });

  it("returns claimed/succeeded/failed/retried counts with empty queue", async () => {
    const result = await runJobsLoopOnce({ limit: 10, runnerId: "loop-test" });
    expect(result.runnerId).toBe("loop-test");
    expect(result.claimed).toBe(0);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.retried).toBe(0);
    expect(result.deadLettered).toBe(0);
    expect(result.canceled).toBe(0);
  });

  it("processes queued job and updates counts", async () => {
    await enqueueJob({ jobType: "run_reminder_rules" });
    const result = await runJobsLoopOnce({ limit: 10, runnerId: "loop-test" });
    expect(result.claimed).toBeGreaterThanOrEqual(1);
    expect(result.succeeded + result.failed + result.retried + result.deadLettered + result.canceled).toBe(result.claimed);
  });
});
