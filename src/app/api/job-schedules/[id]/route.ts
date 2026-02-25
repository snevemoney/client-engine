/**
 * GET/PATCH /api/job-schedules/[id] — Get or update schedule.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { updateSchedule } from "@/lib/jobs/schedules/service";
import { JobScheduleCadenceType } from "@prisma/client";

export const dynamic = "force-dynamic";

function validateCadence(input: {
  cadenceType?: string;
  intervalMinutes?: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
  hour?: number;
  minute?: number;
}): { ok: boolean; error?: string } {
  const ct = input.cadenceType;
  if (ct && !["interval", "daily", "weekly", "monthly"].includes(ct)) {
    return { ok: false, error: "Invalid cadenceType" };
  }
  if (ct === "interval" && input.intervalMinutes != null) {
    const m = input.intervalMinutes;
    if (m < 1 || m > 10080) return { ok: false, error: "intervalMinutes must be 1-10080" };
  }
  if (input.hour != null && (input.hour < 0 || input.hour > 23)) {
    return { ok: false, error: "hour must be 0-23" };
  }
  if (input.minute != null && (input.minute < 0 || input.minute > 59)) {
    return { ok: false, error: "minute must be 0-59" };
  }
  if (input.dayOfWeek != null && (input.dayOfWeek < 0 || input.dayOfWeek > 6)) {
    return { ok: false, error: "dayOfWeek must be 0-6" };
  }
  if (input.dayOfMonth != null && (input.dayOfMonth < 1 || input.dayOfMonth > 31)) {
    return { ok: false, error: "dayOfMonth must be 1-31" };
  }
  return { ok: true };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("GET /api/job-schedules/[id]", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const schedule = await db.jobSchedule.findUnique({ where: { id } });
    if (!schedule) return jsonError("Schedule not found", 404);

    return NextResponse.json({
      id: schedule.id,
      key: schedule.key,
      title: schedule.title,
      description: schedule.description,
      jobType: schedule.jobType,
      isEnabled: schedule.isEnabled,
      cadenceType: schedule.cadenceType,
      intervalMinutes: schedule.intervalMinutes,
      dayOfWeek: schedule.dayOfWeek,
      dayOfMonth: schedule.dayOfMonth,
      hour: schedule.hour,
      minute: schedule.minute,
      timezone: schedule.timezone,
      nextRunAt: schedule.nextRunAt?.toISOString() ?? null,
      lastEnqueuedAt: schedule.lastEnqueuedAt?.toISOString() ?? null,
      lastRunJobId: schedule.lastRunJobId,
      createdAt: schedule.createdAt.toISOString(),
      updatedAt: schedule.updatedAt.toISOString(),
    });
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("PATCH /api/job-schedules/[id]", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const valid = validateCadence({
      cadenceType: body?.cadenceType,
      intervalMinutes: body?.intervalMinutes,
      dayOfWeek: body?.dayOfWeek,
      dayOfMonth: body?.dayOfMonth,
      hour: body?.hour,
      minute: body?.minute,
    });
    if (!valid.ok) return jsonError(valid.error ?? "Invalid cadence", 400);

    const schedule = await updateSchedule(id, {
      title: body?.title,
      description: body?.description,
      jobType: body?.jobType,
      isEnabled: body?.isEnabled,
      cadenceType: body?.cadenceType as JobScheduleCadenceType | undefined,
      intervalMinutes: body?.intervalMinutes,
      dayOfWeek: body?.dayOfWeek,
      dayOfMonth: body?.dayOfMonth,
      hour: body?.hour,
      minute: body?.minute,
      timezone: body?.timezone,
      payloadTemplateJson: body?.payloadTemplateJson,
      dedupeWindowMinutes: body?.dedupeWindowMinutes,
      priority: body?.priority,
      maxAttempts: body?.maxAttempts,
      timeoutSeconds: body?.timeoutSeconds,
    });

    if (!schedule) return jsonError("Schedule not found", 404);

    return NextResponse.json({
      id: schedule.id,
      key: schedule.key,
      title: schedule.title,
      isEnabled: schedule.isEnabled,
      nextRunAt: schedule.nextRunAt?.toISOString() ?? null,
    });
  });
}
