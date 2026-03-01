/**
 * POST /api/jobs/retry-failed — Bulk retry all failed + dead-letter jobs.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { getRequestClientKey, rateLimitByKey } from "@/lib/http/rate-limit";
import { JobRunStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return withRouteTiming("POST /api/jobs/retry-failed", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const clientKey = getRequestClientKey(req, session?.user?.id);
    const rl = rateLimitByKey({ key: `rl:jobs-retry-failed:${clientKey}`, windowMs: 60_000, max: 5 });
    if (!rl.ok) {
      const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { error: true, message: "Rate limit exceeded", retryAfterSeconds: retryAfter },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const result = await db.jobRun.updateMany({
      where: {
        status: { in: [JobRunStatus.failed, JobRunStatus.dead_letter] },
      },
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

    return NextResponse.json({ ok: true, retried: result.count });
  });
}
