/**
 * POST /api/jobs/[id]/retry — Retry failed job (reset to queued).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { getRequestClientKey, rateLimitByKey } from "@/lib/http/rate-limit";
import { JobRunStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/jobs/[id]/retry", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const clientKey = getRequestClientKey(req, session?.user?.id);
    const rl = rateLimitByKey({ key: `rl:jobs-retry:${clientKey}`, windowMs: 60_000, max: 20 });
    if (!rl.ok) {
      const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { error: true, message: "Rate limit exceeded", retryAfterSeconds: retryAfter },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const { id } = await params;

    const job = await db.jobRun.findUnique({ where: { id } });
    if (!job) return jsonError("Job not found", 404);
    if (job.status !== JobRunStatus.failed && job.status !== JobRunStatus.dead_letter) {
      return jsonError("Only failed or dead-letter jobs can be retried", 400);
    }

    await db.jobRun.update({
      where: { id },
      data: {
        status: JobRunStatus.queued,
        runAfter: new Date(),
        lockedAt: null,
        lockOwner: null,
        errorMessage: null,
        errorCode: null,
        deadLetteredAt: null,
      },
    });

    return NextResponse.json({
      ok: true,
      jobId: id,
      status: "queued",
    });
  });
}
