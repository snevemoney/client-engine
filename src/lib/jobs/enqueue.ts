/**
 * Phase 2.8.4: Enqueue jobs with dedupe and idempotency.
 */

import { db } from "@/lib/db";
import { JobRunStatus } from "@prisma/client";
import type { EnqueueInput, JobType } from "./types";
import { sanitizeMeta } from "@/lib/ops-events/sanitize";

export type EnqueueResult = {
  id: string;
  status: string;
  created: boolean;
};

/**
 * Sanitize payload/result for storage (no secrets).
 */
export function sanitizePayload(input: unknown): object | null {
  if (input == null) return null;
  const meta = sanitizeMeta(input);
  return meta as object;
}

/**
 * Enqueue a job. Returns existing if dedupe/idempotency matches.
 */
export async function enqueueJob<T extends JobType>(
  input: EnqueueInput<T>
): Promise<EnqueueResult> {
  const payload = input.payload != null ? sanitizePayload(input.payload) : null;

  if (input.idempotencyKey) {
    const existing = await db.jobRun.findFirst({
      where: { idempotencyKey: input.idempotencyKey },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return {
        id: existing.id,
        status: existing.status,
        created: false,
      };
    }
  }

  if (input.dedupeKey) {
    const open = await db.jobRun.findFirst({
      where: {
        dedupeKey: input.dedupeKey,
        status: { in: [JobRunStatus.queued, JobRunStatus.running] },
      },
    });
    if (open) {
      return {
        id: open.id,
        status: open.status,
        created: false,
      };
    }
  }

  const job = await db.jobRun.create({
    data: {
      jobType: input.jobType,
      status: JobRunStatus.queued,
      priority: input.priority ?? 50,
      idempotencyKey: input.idempotencyKey ?? null,
      dedupeKey: input.dedupeKey ?? null,
      payloadJson: payload ?? undefined,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      createdByUserId: input.createdByUserId ?? null,
      maxAttempts: input.maxAttempts ?? 3,
      timeoutSeconds: input.timeoutSeconds ?? null,
    },
  });

  return {
    id: job.id,
    status: job.status,
    created: true,
  };
}

/**
 * Add a log entry for a job.
 */
export async function addJobLog(
  jobId: string,
  level: "info" | "warn" | "error",
  message: string,
  meta?: Record<string, unknown>
): Promise<void> {
  const metaJson = meta != null ? sanitizePayload(meta) : null;
  await db.jobLog.create({
    data: {
      jobId,
      level,
      message: message.slice(0, 2000),
      metaJson: metaJson ?? undefined,
    },
  });
}
