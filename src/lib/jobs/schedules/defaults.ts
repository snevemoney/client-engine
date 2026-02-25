/**
 * Phase 2.8.5: Default job schedules (manual-first, all disabled).
 */

import type { JobScheduleCadenceType } from "@prisma/client";
import { createSchedule } from "./service";

export type DefaultSchedule = {
  key: string;
  title: string;
  description: string;
  jobType: string;
  cadenceType: JobScheduleCadenceType;
  intervalMinutes?: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
  hour?: number;
  minute?: number;
  isEnabled?: boolean;
};

export const DEFAULT_SCHEDULES: DefaultSchedule[] = [
  {
    key: "weekly_metrics_snapshot",
    title: "Weekly Metrics Snapshot",
    description: "Capture weekly conversion, revenue, and trend metrics",
    jobType: "capture_metrics_snapshot",
    cadenceType: "weekly",
    dayOfWeek: 1,
    hour: 9,
    minute: 0,
    isEnabled: false,
  },
  {
    key: "weekly_operator_score_snapshot",
    title: "Weekly Operator Score Snapshot",
    description: "Capture weekly and monthly operator score",
    jobType: "capture_operator_score_snapshot",
    cadenceType: "weekly",
    dayOfWeek: 1,
    hour: 9,
    minute: 15,
    isEnabled: false,
  },
  {
    key: "weekly_forecast_snapshot",
    title: "Weekly Forecast Snapshot",
    description: "Capture weekly and monthly forecast",
    jobType: "capture_forecast_snapshot",
    cadenceType: "weekly",
    dayOfWeek: 1,
    hour: 9,
    minute: 30,
    isEnabled: false,
  },
  {
    key: "daily_reminder_rules",
    title: "Daily Reminder Rules",
    description: "Run reminder rules to generate open reminders",
    jobType: "run_reminder_rules",
    cadenceType: "daily",
    hour: 8,
    minute: 0,
    isEnabled: false,
  },
  {
    key: "daily_automation_suggestions",
    title: "Daily Automation Suggestions",
    description: "Generate automation suggestions from current state",
    jobType: "generate_automation_suggestions",
    cadenceType: "daily",
    hour: 8,
    minute: 30,
    isEnabled: false,
  },
  {
    key: "notifications_evaluate_escalations",
    title: "Evaluate Notification Escalations",
    description: "Evaluate escalation rules and create notification events",
    jobType: "notifications.evaluate_escalations",
    cadenceType: "interval",
    intervalMinutes: 10,
    isEnabled: true,
  },
  {
    key: "notifications_dispatch_pending",
    title: "Dispatch Pending Notifications",
    description: "Send queued notification deliveries",
    jobType: "notifications.dispatch_pending",
    cadenceType: "interval",
    intervalMinutes: 5,
    isEnabled: true,
  },
];
