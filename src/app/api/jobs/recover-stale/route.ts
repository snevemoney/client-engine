/**
 * POST /api/jobs/recover-stale — Requeue jobs stuck in running (stale lock).
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { getRequestClientKey, rateLimitByKey } from "@/lib/http/rate-limit";
import { db } from "@/lib/db";
import { JobRunStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const STALE_MINUTES = 10;

export async function POST(request: NextRequest) {
  return withRouteTiming("POST /api/jobs/recover-stale", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const clientKey = getRequestClientKey(request, session?.user?.id);
    const rl = rateLimitByKey({ key: `rl:jobs-recover:${clientKey}`, windowMs: 60_000, max: 5 });
    if (!rl.ok) {
      const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { error: true, message: "Rate limit exceeded", retryAfterSeconds: retryAfter },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const threshold = new Date(Date.now() - STALE_MINUTES * 60 * 1000);

    const result = await db.jobRun.updateMany({
      where: {
        status: JobRunStatus.running,
        lockedAt: { lt: threshold },
      },
      data: {
        status: JobRunStatus.queued,
        runAfter: new Date(),
        lockedAt: null,
        lockOwner: null,
      },
    });

    return NextResponse.json({
      ok: true,
      recovered: result.count,
    });
  });
}
