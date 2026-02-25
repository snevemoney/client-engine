/**
 * POST /api/job-schedules/[id]/run-now — Enqueue one job immediately.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { computeNextRunAt } from "@/lib/jobs/schedules/next-run";
import type { JobType } from "@/lib/jobs/types";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/job-schedules/[id]/run-now", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const force = body?.force === true;

    const schedule = await db.jobSchedule.findUnique({ where: { id } });
    if (!schedule) return jsonError("Schedule not found", 404);

    const now = new Date();
    const dedupeKey = force ? `schedule:${id}:run-now:${now.getTime()}` : `schedule:${id}:run-now`;
    const payload = (schedule.payloadTemplateJson as object) ?? {};

    const result = await enqueueJob({
      jobType: schedule.jobType as JobType,
      payload: Object.keys(payload).length > 0 ? payload : undefined,
      priority: schedule.priority,
      maxAttempts: schedule.maxAttempts,
      timeoutSeconds: schedule.timeoutSeconds ?? undefined,
      dedupeKey: force ? undefined : dedupeKey,
      sourceType: "schedule",
      sourceId: schedule.id,
    });

    if (result.created) {
      const nextRunAt = schedule.isEnabled
        ? computeNextRunAt(
            {
              cadenceType: schedule.cadenceType,
              intervalMinutes: schedule.intervalMinutes,
              dayOfWeek: schedule.dayOfWeek,
              dayOfMonth: schedule.dayOfMonth,
              hour: schedule.hour,
              minute: schedule.minute,
            },
            now
          )
        : null;

      await db.jobSchedule.update({
        where: { id },
        data: {
          lastEnqueuedAt: now,
          lastRunJobId: result.id,
          nextRunAt,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      jobId: result.id,
      status: result.status,
      created: result.created,
    });
  });
}
