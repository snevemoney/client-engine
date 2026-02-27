/**
 * Phase 2.8.4: Job type definitions and payload types.
 */

export const JOB_TYPES = [
  "capture_metrics_snapshot",
  "capture_operator_score_snapshot",
  "capture_forecast_snapshot",
  "run_reminder_rules",
  "generate_automation_suggestions",
  "notifications.dispatch_pending",
  "notifications.evaluate_escalations",
  "score.compute",
  "retry_failed_deliveries",
] as const;

export type JobType = (typeof JOB_TYPES)[number];

export type JobPayloadMap = {
  capture_metrics_snapshot: { weekStart?: string };
  capture_operator_score_snapshot: Record<string, never>;
  capture_forecast_snapshot: Record<string, never>;
  run_reminder_rules: Record<string, never>;
  generate_automation_suggestions: Record<string, never>;
  "notifications.dispatch_pending": { limit?: number };
  "notifications.evaluate_escalations": { limit?: number };
  "score.compute": { entityType: string; entityId: string };
  retry_failed_deliveries: { nextActionId: string };
};

export type JobPayload = JobPayloadMap[JobType];

export type EnqueueInput<T extends JobType = JobType> = {
  jobType: T;
  payload?: JobPayloadMap[T];
  priority?: number;
  maxAttempts?: number;
  timeoutSeconds?: number;
  idempotencyKey?: string;
  dedupeKey?: string;
  sourceType?: string;
  sourceId?: string;
  createdByUserId?: string;
};
