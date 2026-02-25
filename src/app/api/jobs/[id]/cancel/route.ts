/**
 * POST /api/jobs/[id]/cancel — Cancel queued or running job.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { JobRunStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/jobs/[id]/cancel", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { id } = await params;

    const job = await db.jobRun.findUnique({ where: { id } });
    if (!job) return jsonError("Job not found", 404);
    if (job.status !== JobRunStatus.queued && job.status !== JobRunStatus.running) {
      return jsonError("Only queued or running jobs can be canceled", 400);
    }

    const now = new Date();

    if (job.status === JobRunStatus.queued) {
      await db.jobRun.update({
        where: { id },
        data: {
          status: JobRunStatus.canceled,
          canceledAt: now,
          finishedAt: now,
          lockedAt: null,
          lockOwner: null,
        },
      });
      return NextResponse.json({ ok: true, jobId: id, status: "canceled" });
    }

    await db.jobRun.update({
      where: { id },
      data: { cancelRequestedAt: now },
    });
    return NextResponse.json({
      ok: true,
      jobId: id,
      status: "cancel_requested",
      message: "Cancel requested; runner will mark canceled when it checks",
    });
  });
}
