/**
 * Phase 2.8.4: Atomically claim queued jobs.
 */

import { db } from "@/lib/db";
import { JobRunStatus } from "@prisma/client";

const STALE_LOCK_MINUTES = 10;

/**
 * Claim up to `limit` eligible queued jobs for runner.
 * Eligible: status=queued, runAfter <= now, not locked or lock stale.
 */
export async function claimNextJobs(opts: {
  limit: number;
  runnerId: string;
  now?: Date;
}): Promise<{ id: string; jobType: string; payloadJson: unknown; attempts: number; maxAttempts: number; timeoutSeconds: number | null }[]> {
  const now = opts.now ?? new Date();
  const staleThreshold = new Date(now.getTime() - STALE_LOCK_MINUTES * 60 * 1000);

  const eligible = await db.jobRun.findMany({
    where: {
      status: JobRunStatus.queued,
      runAfter: { lte: now },
      OR: [
        { lockedAt: null },
        { lockedAt: { lt: staleThreshold } },
      ],
    },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    take: opts.limit,
  });

  const claimed: { id: string; jobType: string; payloadJson: unknown; attempts: number; maxAttempts: number; timeoutSeconds: number | null }[] = [];

  for (const job of eligible) {
    const updated = await db.jobRun.updateMany({
      where: {
        id: job.id,
        status: JobRunStatus.queued,
        runAfter: { lte: now },
        OR: [
          { lockedAt: null },
          { lockedAt: { lt: staleThreshold } },
        ],
      },
      data: {
        status: JobRunStatus.running,
        lockedAt: now,
        lockOwner: opts.runnerId,
        startedAt: now,
        heartbeatAt: now,
        attempts: { increment: 1 },
      },
    });

    if (updated.count > 0) {
      claimed.push({
        id: job.id,
        jobType: job.jobType,
        payloadJson: job.payloadJson ?? undefined,
        attempts: job.attempts + 1,
        maxAttempts: job.maxAttempts,
        timeoutSeconds: job.timeoutSeconds,
      });
    }
  }

  return claimed;
}
