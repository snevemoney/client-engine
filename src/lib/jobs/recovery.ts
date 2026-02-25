/**
 * Phase 2.8.5: Stale running job recovery.
 */

import { db } from "@/lib/db";
import { JobRunStatus } from "@prisma/client";
import { addJobLog } from "./enqueue";
import { nextRunAfter } from "./backoff";

export type RecoverStaleResult = {
  count: number;
  requeued: number;
  deadLettered: number;
};

/**
 * Recover running jobs with stale lock/heartbeat.
 * If attempts < maxAttempts => requeue.
 * Else => dead_letter.
 */
export async function recoverStaleRunningJobs(opts: {
  staleAfterMinutes?: number;
  now?: Date;
}): Promise<RecoverStaleResult> {
  const now = opts.now ?? new Date();
  const staleMinutes = opts.staleAfterMinutes ?? 10;
  const threshold = new Date(now.getTime() - staleMinutes * 60 * 1000);

  const stale = await db.jobRun.findMany({
    where: {
      status: JobRunStatus.running,
      OR: [
        { lockedAt: { lt: threshold } },
        { lockedAt: null, startedAt: { lt: threshold } },
      ],
    },
  });

  let requeued = 0;
  let deadLettered = 0;

  for (const job of stale) {
    const effectiveLocked = job.lockedAt ?? job.startedAt;
    if (effectiveLocked && effectiveLocked >= threshold) continue;

    if (job.attempts < job.maxAttempts) {
      const runAfter = nextRunAfter(job.attempts);
      await db.jobRun.update({
        where: { id: job.id },
        data: {
          status: JobRunStatus.queued,
          runAfter,
          lockedAt: null,
          lockOwner: null,
          heartbeatAt: null,
          startedAt: null,
        },
      });
      await addJobLog(job.id, "warn", "Stale job requeued", {
        lockedAt: job.lockedAt?.toISOString(),
        runAfter: runAfter.toISOString(),
      });
      requeued++;
    } else {
      await db.jobRun.update({
        where: { id: job.id },
        data: {
          status: JobRunStatus.dead_letter,
          deadLetteredAt: now,
          finishedAt: now,
          lockedAt: null,
          lockOwner: null,
          heartbeatAt: null,
        },
      });
      await addJobLog(job.id, "error", "Stale job dead-lettered (max attempts)", {
        attempts: job.attempts,
      });
      deadLettered++;
    }
  }

  return {
    count: stale.length,
    requeued,
    deadLettered,
  };
}
