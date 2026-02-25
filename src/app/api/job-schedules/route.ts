/**
 * GET/POST /api/job-schedules — List or create schedules.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { listSchedules, createSchedule } from "@/lib/jobs/schedules/service";
import { JobScheduleCadenceType } from "@prisma/client";

export const dynamic = "force-dynamic";

function validateCadence(input: {
  cadenceType: string;
  intervalMinutes?: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
  hour?: number;
  minute?: number;
}): { ok: boolean; error?: string } {
  const ct = input.cadenceType as JobScheduleCadenceType;
  if (!["interval", "daily", "weekly", "monthly"].includes(ct)) {
    return { ok: false, error: "Invalid cadenceType" };
  }
  if (ct === "interval") {
    const m = input.intervalMinutes ?? 0;
    if (m < 1 || m > 10080) return { ok: false, error: "intervalMinutes must be 1-10080" };
  }
  if (ct === "daily" || ct === "weekly" || ct === "monthly") {
    const h = input.hour ?? 0;
    const m = input.minute ?? 0;
    if (h < 0 || h > 23) return { ok: false, error: "hour must be 0-23" };
    if (m < 0 || m > 59) return { ok: false, error: "minute must be 0-59" };
  }
  if (ct === "weekly") {
    const dow = input.dayOfWeek ?? 0;
    if (dow < 0 || dow > 6) return { ok: false, error: "dayOfWeek must be 0-6 (Sun-Sat)" };
  }
  if (ct === "monthly") {
    const dom = input.dayOfMonth ?? 1;
    if (dom < 1 || dom > 31) return { ok: false, error: "dayOfMonth must be 1-31" };
  }
  return { ok: true };
}

export async function GET() {
  return withRouteTiming("GET /api/job-schedules", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const schedules = await listSchedules();
    return NextResponse.json({
      items: schedules.map((s) => ({
        id: s.id,
        key: s.key,
        title: s.title,
        description: s.description,
        jobType: s.jobType,
        isEnabled: s.isEnabled,
        cadenceType: s.cadenceType,
        intervalMinutes: s.intervalMinutes,
        dayOfWeek: s.dayOfWeek,
        dayOfMonth: s.dayOfMonth,
        hour: s.hour,
        minute: s.minute,
        nextRunAt: s.nextRunAt?.toISOString() ?? null,
        lastEnqueuedAt: s.lastEnqueuedAt?.toISOString() ?? null,
        lastRunJobId: s.lastRunJobId,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      })),
    });
  });
}

export async function POST(request: NextRequest) {
  return withRouteTiming("POST /api/job-schedules", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const body = await request.json().catch(() => ({}));
    const key = body?.key?.trim();
    const title = body?.title?.trim();
    const jobType = body?.jobType?.trim();
    const cadenceType = body?.cadenceType;

    if (!key || !title || !jobType || !cadenceType) {
      return jsonError("Missing required: key, title, jobType, cadenceType", 400);
    }

    const valid = validateCadence({
      cadenceType,
      intervalMinutes: body?.intervalMinutes,
      dayOfWeek: body?.dayOfWeek,
      dayOfMonth: body?.dayOfMonth,
      hour: body?.hour,
      minute: body?.minute,
    });
    if (!valid.ok) return jsonError(valid.error ?? "Invalid cadence", 400);

    const schedule = await createSchedule({
      key,
      title,
      description: body?.description ?? null,
      jobType,
      isEnabled: body?.isEnabled ?? true,
      cadenceType: cadenceType as JobScheduleCadenceType,
      intervalMinutes: body?.intervalMinutes ?? null,
      dayOfWeek: body?.dayOfWeek ?? null,
      dayOfMonth: body?.dayOfMonth ?? null,
      hour: body?.hour ?? null,
      minute: body?.minute ?? null,
      timezone: body?.timezone ?? null,
      payloadTemplateJson: body?.payloadTemplateJson ?? null,
      dedupeWindowMinutes: body?.dedupeWindowMinutes ?? 60,
      priority: body?.priority ?? 50,
      maxAttempts: body?.maxAttempts ?? 3,
      timeoutSeconds: body?.timeoutSeconds ?? null,
    });

    return NextResponse.json({
      id: schedule.id,
      key: schedule.key,
      title: schedule.title,
      nextRunAt: schedule.nextRunAt?.toISOString() ?? null,
    });
  });
}
