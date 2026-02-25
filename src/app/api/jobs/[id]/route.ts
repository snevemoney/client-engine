/**
 * GET /api/jobs/[id] — Job details + logs.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("GET /api/jobs/[id]", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;

    const job = await db.jobRun.findUnique({
      where: { id },
      include: {
        logs: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!job) return jsonError("Job not found", 404);

    return NextResponse.json({
      id: job.id,
      jobType: job.jobType,
      status: job.status,
      priority: job.priority,
      idempotencyKey: job.idempotencyKey,
      dedupeKey: job.dedupeKey,
      payloadJson: job.payloadJson ?? undefined,
      resultJson: job.resultJson ?? undefined,
      errorMessage: job.errorMessage,
      errorCode: job.errorCode,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      runAfter: job.runAfter?.toISOString() ?? null,
      lockedAt: job.lockedAt?.toISOString() ?? null,
      lockOwner: job.lockOwner,
      startedAt: job.startedAt?.toISOString() ?? null,
      finishedAt: job.finishedAt?.toISOString() ?? null,
      sourceType: job.sourceType,
      sourceId: job.sourceId,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      logs: job.logs.map((l) => ({
        id: l.id,
        level: l.level,
        message: l.message,
        metaJson: l.metaJson ?? undefined,
        createdAt: l.createdAt.toISOString(),
      })),
    });
  });
}
