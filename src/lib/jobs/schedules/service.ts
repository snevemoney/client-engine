/**
 * Phase 2.8.5: Schedule service — list, create, update, enqueue due.
 */

import { db } from "@/lib/db";
import { JobScheduleCadenceType } from "@prisma/client";
import { computeNextRunAt } from "./next-run";
import { enqueueJob } from "../enqueue";
import type { JobType } from "../types";

export type ScheduleCreateInput = {
  key: string;
  title: string;
  description?: string | null;
  jobType: string;
  isEnabled?: boolean;
  cadenceType: JobScheduleCadenceType;
  intervalMinutes?: number | null;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  hour?: number | null;
  minute?: number | null;
  timezone?: string | null;
  payloadTemplateJson?: object | null;
  dedupeWindowMinutes?: number | null;
  priority?: number;
  maxAttempts?: number;
  timeoutSeconds?: number | null;
};

export type ScheduleUpdateInput = Partial<ScheduleCreateInput>;

export type EnqueueDueResult = {
  dueSchedules: number;
  jobsEnqueued: number;
  jobIds: string[];
};

/**
 * List all schedules.
 */
export async function listSchedules(): Promise<
  Awaited<ReturnType<typeof db.jobSchedule.findMany>>
> {
  return db.jobSchedule.findMany({
    orderBy: { key: "asc" },
  });
}

/**
 * Create a schedule and compute initial nextRunAt.
 */
export async function createSchedule(input: ScheduleCreateInput) {
  const nextRunAt = input.isEnabled !== false
    ? computeNextRunAt(
        {
          cadenceType: input.cadenceType,
          intervalMinutes: input.intervalMinutes,
          dayOfWeek: input.dayOfWeek,
          dayOfMonth: input.dayOfMonth,
          hour: input.hour,
          minute: input.minute,
        },
        new Date()
      )
    : null;

  return db.jobSchedule.create({
    data: {
      key: input.key,
      title: input.title,
      description: input.description ?? null,
      jobType: input.jobType,
      isEnabled: input.isEnabled ?? true,
      cadenceType: input.cadenceType,
      intervalMinutes: input.intervalMinutes ?? null,
      dayOfWeek: input.dayOfWeek ?? null,
      dayOfMonth: input.dayOfMonth ?? null,
      hour: input.hour ?? null,
      minute: input.minute ?? null,
      timezone: input.timezone ?? null,
      payloadTemplateJson: input.payloadTemplateJson ?? undefined,
      dedupeWindowMinutes: input.dedupeWindowMinutes ?? 60,
      priority: input.priority ?? 50,
      maxAttempts: input.maxAttempts ?? 3,
      timeoutSeconds: input.timeoutSeconds ?? null,
      nextRunAt,
    },
  });
}

/**
 * Update schedule and optionally recompute nextRunAt.
 */
export async function updateSchedule(
  id: string,
  input: ScheduleUpdateInput
) {
  const existing = await db.jobSchedule.findUnique({ where: { id } });
  if (!existing) return null;

  const willBeEnabled = input.isEnabled !== false && input.isEnabled !== undefined ? input.isEnabled : existing.isEnabled;
  const nextRunAt = willBeEnabled
    ? computeNextRunAt(
        {
          cadenceType: input.cadenceType ?? existing.cadenceType,
          intervalMinutes: input.intervalMinutes ?? existing.intervalMinutes,
          dayOfWeek: input.dayOfWeek ?? existing.dayOfWeek,
          dayOfMonth: input.dayOfMonth ?? existing.dayOfMonth,
          hour: input.hour ?? existing.hour,
          minute: input.minute ?? existing.minute,
        },
        new Date()
      )
    : null;

  return db.jobSchedule.update({
    where: { id },
    data: {
      ...(input.title != null && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.jobType != null && { jobType: input.jobType }),
      ...(input.isEnabled !== undefined && { isEnabled: input.isEnabled }),
      ...(input.cadenceType != null && { cadenceType: input.cadenceType }),
      ...(input.intervalMinutes !== undefined && { intervalMinutes: input.intervalMinutes }),
      ...(input.dayOfWeek !== undefined && { dayOfWeek: input.dayOfWeek }),
      ...(input.dayOfMonth !== undefined && { dayOfMonth: input.dayOfMonth }),
      ...(input.hour !== undefined && { hour: input.hour }),
      ...(input.minute !== undefined && { minute: input.minute }),
      ...(input.timezone !== undefined && { timezone: input.timezone }),
      ...(input.payloadTemplateJson !== undefined && { payloadTemplateJson: input.payloadTemplateJson ?? undefined }),
      ...(input.dedupeWindowMinutes !== undefined && { dedupeWindowMinutes: input.dedupeWindowMinutes }),
      ...(input.priority != null && { priority: input.priority }),
      ...(input.maxAttempts != null && { maxAttempts: input.maxAttempts }),
      ...(input.timeoutSeconds !== undefined && { timeoutSeconds: input.timeoutSeconds }),
      ...(nextRunAt !== undefined && { nextRunAt }),
    },
  });
}

/**
 * Enqueue jobs for due schedules. Idempotent via dedupeKey.
 */
export async function enqueueDueSchedules(opts: {
  now?: Date;
  limit?: number;
}): Promise<EnqueueDueResult> {
  const now = opts.now ?? new Date();
  const limit = Math.min(opts.limit ?? 20, 50);

  const due = await db.jobSchedule.findMany({
    where: {
      isEnabled: true,
      nextRunAt: { lte: now },
    },
    orderBy: { nextRunAt: "asc" },
    take: limit,
  });

  const jobIds: string[] = [];

  for (const s of due) {
    const timeBucket = s.cadenceType === "interval"
      ? Math.floor(now.getTime() / 60000)
      : now.toISOString().slice(0, 13);
    const dedupeKey = `schedule:${s.id}:${timeBucket}`;

    const payload = (s.payloadTemplateJson as object) ?? {};
    const result = await enqueueJob({
      jobType: s.jobType as JobType,
      payload: Object.keys(payload).length > 0 ? payload : undefined,
      priority: s.priority,
      maxAttempts: s.maxAttempts,
      timeoutSeconds: s.timeoutSeconds ?? undefined,
      dedupeKey,
      sourceType: "schedule",
      sourceId: s.id,
    });

    if (result.created) {
      jobIds.push(result.id);
    }

    const nextRunAt = computeNextRunAt(
      {
        cadenceType: s.cadenceType,
        intervalMinutes: s.intervalMinutes,
        dayOfWeek: s.dayOfWeek,
        dayOfMonth: s.dayOfMonth,
        hour: s.hour,
        minute: s.minute,
      },
      now
    );

    await db.jobSchedule.update({
      where: { id: s.id },
      data: {
        lastEnqueuedAt: now,
        lastRunJobId: result.created ? result.id : s.lastRunJobId,
        nextRunAt,
      },
    });
  }

  return {
    dueSchedules: due.length,
    jobsEnqueued: jobIds.length,
    jobIds,
  };
}
