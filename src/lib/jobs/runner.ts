/**
 * Phase 2.8.4/2.8.5: Job runner — execute claimed jobs.
 * Supports timeout, heartbeat, dead-letter, cancellation.
 */

import { db } from "@/lib/db";
import { JobRunStatus } from "@prisma/client";
import { addJobLog, sanitizePayload } from "./enqueue";
import { nextRunAfter } from "./backoff";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import type { JobType } from "./types";
import { handleCaptureMetricsSnapshot } from "./handlers/capture-metrics-snapshot";
import { handleCaptureOperatorScoreSnapshot } from "./handlers/capture-operator-score-snapshot";
import { handleCaptureForecastSnapshot } from "./handlers/capture-forecast-snapshot";
import { handleRunReminderRules } from "./handlers/run-reminder-rules";
import { handleGenerateAutomationSuggestions } from "./handlers/generate-automation-suggestions";
import { handleNotificationsDispatchPending } from "./handlers/notifications-dispatch-pending";
import { handleNotificationsEvaluateEscalations } from "./handlers/notifications-evaluate-escalations";
import { handleScoreCompute } from "./handlers/score-compute";
import { handleRetryFailedDeliveries } from "./handlers/retry-failed-deliveries";

const DEFAULT_TIMEOUT_SECONDS = 120;

export type ClaimedJob = {
  id: string;
  jobType: string;
  payloadJson: unknown;
  attempts: number;
  maxAttempts: number;
  timeoutSeconds: number | null;
};

export type RunLoopResult = {
  claimed: number;
  succeeded: number;
  failed: number;
  retried: number;
  deadLettered: number;
  canceled: number;
  runnerId: string;
};

async function executeJobByType(
  jobType: string,
  payload: unknown
): Promise<object> {
  const typed = jobType as JobType;
  switch (typed) {
    case "capture_metrics_snapshot":
      return handleCaptureMetricsSnapshot(
        payload as { weekStart?: string }
      );
    case "capture_operator_score_snapshot":
      return handleCaptureOperatorScoreSnapshot();
    case "capture_forecast_snapshot":
      return handleCaptureForecastSnapshot();
    case "run_reminder_rules":
      return handleRunReminderRules();
    case "generate_automation_suggestions":
      return handleGenerateAutomationSuggestions();
    case "notifications.dispatch_pending":
      return handleNotificationsDispatchPending((payload ?? {}) as { limit?: number });
    case "notifications.evaluate_escalations":
      return handleNotificationsEvaluateEscalations((payload ?? {}) as { limit?: number });
    case "score.compute":
      return handleScoreCompute((payload ?? {}) as { entityType: string; entityId: string });
    case "retry_failed_deliveries":
      return handleRetryFailedDeliveries((payload ?? {}) as { nextActionId: string });
    default:
      throw new Error(`Unknown job type: ${jobType}`);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Job timed out after ${ms}ms`)), ms)
    ),
  ]);
}

export async function runClaimedJob(
  job: ClaimedJob,
  runnerId: string
): Promise<{ ok: boolean; retried?: boolean; deadLettered?: boolean; canceled?: boolean }> {
  const { id, jobType, payloadJson, attempts, maxAttempts, timeoutSeconds } = job;
  const maxAttemptsVal = maxAttempts ?? 3;
  const timeoutMs = (timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS) * 1000;

  const now = new Date();

  const canceled = await db.jobRun.findUnique({
    where: { id },
    select: { cancelRequestedAt: true },
  });
  if (canceled?.cancelRequestedAt) {
    await db.jobRun.update({
      where: { id },
      data: {
        status: JobRunStatus.canceled,
        canceledAt: now,
        finishedAt: now,
        lockedAt: null,
        lockOwner: null,
        heartbeatAt: null,
      },
    });
    await addJobLog(id, "info", "Job canceled (requested)");
    return { ok: false, canceled: true };
  }

  try {
    const execPromise = executeJobByType(jobType, payloadJson ?? {});
    const result = await withTimeout(execPromise, timeoutMs);
    const resultJson = sanitizePayload(result);

    await db.jobRun.update({
      where: { id },
      data: {
        status: JobRunStatus.succeeded,
        finishedAt: now,
        resultJson: resultJson ?? undefined,
        lockedAt: null,
        lockOwner: null,
        heartbeatAt: now,
      },
    });

    await addJobLog(id, "info", "Job succeeded", { resultKeys: result ? Object.keys(result as object) : [] });
    return { ok: true };
  } catch (err) {
    const errorMessage = sanitizeErrorMessage(err);
    const errorCode = err instanceof Error ? err.name : "Error";

    if (attempts < maxAttemptsVal) {
      const runAfter = nextRunAfter(attempts);
      await db.jobRun.update({
        where: { id },
        data: {
          status: JobRunStatus.queued,
          runAfter,
          lockedAt: null,
          lockOwner: null,
          lastErrorAt: now,
          errorMessage: errorMessage,
          errorCode: errorCode,
        },
      });
      await addJobLog(id, "warn", `Retry scheduled (attempt ${attempts}/${maxAttemptsVal})`, {
        error: errorMessage,
        runAfter: runAfter.toISOString(),
      });
      return { ok: false, retried: true };
    }

    await db.jobRun.update({
      where: { id },
      data: {
        status: JobRunStatus.dead_letter,
        deadLetteredAt: now,
        finishedAt: now,
        lastErrorAt: now,
        errorMessage: errorMessage,
        errorCode: errorCode,
        lockedAt: null,
        lockOwner: null,
      },
    });
    await addJobLog(id, "error", "Job dead-lettered (max attempts)", { error: errorMessage });
    return { ok: false, deadLettered: true };
  }
}

export async function runJobsLoopOnce(opts: {
  limit?: number;
  runnerId: string;
}): Promise<RunLoopResult> {
  const limit = Math.min(opts.limit ?? 10, 50);
  const runnerId = opts.runnerId;
  const { claimNextJobs } = await import("./claim");

  const claimed = await claimNextJobs({ limit, runnerId });
  let succeeded = 0;
  let failed = 0;
  let retried = 0;
  let deadLettered = 0;
  let canceled = 0;

  for (const job of claimed) {
    const result = await runClaimedJob(job, runnerId);
    if (result.ok) succeeded++;
    else if (result.retried) retried++;
    else if (result.deadLettered) deadLettered++;
    else if (result.canceled) canceled++;
    else failed++;
  }

  return {
    claimed: claimed.length,
    succeeded,
    failed,
    retried,
    deadLettered,
    canceled,
    runnerId,
  };
}
