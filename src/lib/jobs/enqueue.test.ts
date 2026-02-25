/**
 * Phase 2.8.4: Enqueue tests.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { enqueueJob } from "./enqueue";
import { JobRunStatus } from "@prisma/client";

describe("enqueueJob", () => {
  beforeEach(async () => {
    await db.jobRun.deleteMany({});
  });

  it("creates job", async () => {
    const result = await enqueueJob({
      jobType: "capture_metrics_snapshot",
      sourceType: "test",
    });
    expect(result.created).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.status).toBe("queued");

    const job = await db.jobRun.findUnique({ where: { id: result.id } });
    expect(job?.jobType).toBe("capture_metrics_snapshot");
    expect(job?.status).toBe(JobRunStatus.queued);
  });

  it("dedupeKey returns existing queued job", async () => {
    const key = "dedupe:test:1";
    const first = await enqueueJob({
      jobType: "run_reminder_rules",
      dedupeKey: key,
    });
    expect(first.created).toBe(true);

    const second = await enqueueJob({
      jobType: "run_reminder_rules",
      dedupeKey: key,
    });
    expect(second.created).toBe(false);
    expect(second.id).toBe(first.id);
  });

  it("idempotencyKey returns existing job", async () => {
    const key = "idem:test:1";
    const first = await enqueueJob({
      jobType: "capture_forecast_snapshot",
      idempotencyKey: key,
    });
    expect(first.created).toBe(true);

    const second = await enqueueJob({
      jobType: "capture_forecast_snapshot",
      idempotencyKey: key,
    });
    expect(second.created).toBe(false);
    expect(second.id).toBe(first.id);
  });

  it("allows new job after prior succeeded when dedupe allows", async () => {
    const first = await enqueueJob({
      jobType: "capture_metrics_snapshot",
      dedupeKey: "metrics:2025-02-22",
    });
    expect(first.created).toBe(true);

    await db.jobRun.update({
      where: { id: first.id },
      data: { status: JobRunStatus.succeeded },
    });

    const second = await enqueueJob({
      jobType: "capture_metrics_snapshot",
      dedupeKey: "metrics:2025-02-23",
    });
    expect(second.created).toBe(true);
    expect(second.id).not.toBe(first.id);
  });
});
