/**
 * Phase 2.8.6: Build human-readable notification title/message from domain events.
 */

import type { Severity } from "./types";

export type FormatInput = {
  eventKey: string;
  sourceType?: string | null;
  sourceId?: string | null;
  meta?: Record<string, unknown> | null;
};

export function formatNotificationTitle(input: FormatInput): string {
  const { eventKey, sourceType, meta } = input;
  switch (eventKey) {
    case "job.dead_letter":
      return `Job dead-lettered: ${(meta?.jobType as string) ?? "unknown"}`;
    case "job.stale_running":
      return `Stale running job: ${(meta?.jobType as string) ?? "unknown"}`;
    case "reminder.overdue":
      return `Reminder overdue: ${(meta?.title as string) ?? "Reminder"}`;
    case "reminder.critical_overdue":
      return `Critical reminder overdue: ${(meta?.title as string) ?? "Reminder"}`;
    case "review.weekly_missing":
      return "Weekly review missing";
    case "snapshot.metrics_missing":
      return "Metrics snapshot missing";
    case "snapshot.operator_missing":
      return "Operator score snapshot missing";
    case "snapshot.forecast_missing":
      return "Forecast snapshot missing";
    case "delivery.retention_overdue":
      return "Retention follow-up overdue";
    default:
      return (meta?.title as string) ?? eventKey ?? "Notification";
  }
}

export function formatNotificationMessage(input: FormatInput): string {
  const { eventKey, sourceType, sourceId, meta } = input;
  const err = (meta?.error as string) ?? "";
  const due = (meta?.dueAt as string) ?? "";
  const jobType = (meta?.jobType as string) ?? "";
  const attempts = (meta?.attempts as number) ?? 0;

  switch (eventKey) {
    case "job.dead_letter":
      return `Job ${jobType || "unknown"} failed after ${attempts} attempts. ${err ? `Error: ${err}` : ""}`.trim();
    case "job.stale_running":
      return `Job ${jobType || "unknown"} has been running too long. Consider recovery.`;
    case "reminder.overdue":
      return `Reminder "${meta?.title ?? "—"}" was due ${due ? new Date(due).toLocaleDateString("en-US") : ""}.`;
    case "reminder.critical_overdue":
      return `Critical reminder "${meta?.title ?? "—"}" is overdue. Action required.`;
    case "review.weekly_missing":
      return "Weekly strategy review has not been completed for this week.";
    case "snapshot.metrics_missing":
      return "Weekly metrics snapshot has not been captured.";
    case "snapshot.operator_missing":
      return "Operator score snapshot has not been captured.";
    case "snapshot.forecast_missing":
      return "Forecast snapshot has not been captured.";
    case "delivery.retention_overdue":
      return `Retention follow-up is overdue for delivery ${sourceId ?? "—"}.`;
    default:
      return (meta?.message as string) ?? (meta?.description as string) ?? "";
  }
}
