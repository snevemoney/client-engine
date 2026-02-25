/**
 * POST /api/jobs/tick — Cron-ready: recover stale, enqueue due schedules, run queue.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { getRequestClientKey, rateLimitByKey } from "@/lib/http/rate-limit";
import { recoverStaleRunningJobs } from "@/lib/jobs/recovery";
import { enqueueDueSchedules } from "@/lib/jobs/schedules/service";
import { runJobsLoopOnce } from "@/lib/jobs/runner";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return withRouteTiming("POST /api/jobs/tick", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const clientKey = getRequestClientKey(request, session?.user?.id);
    const rl = rateLimitByKey({ key: `rl:jobs-tick:${clientKey}`, windowMs: 60_000, max: 20 });
    if (!rl.ok) {
      const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { error: true, message: "Rate limit exceeded", retryAfterSeconds: retryAfter },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    try {
      const body = await request.json().catch(() => ({}));
      const run = body?.run !== false;
      const enqueueSchedules = body?.enqueueSchedules !== false;
      const recoverStale = body?.recoverStale !== false;
      const limit = Math.min(Math.max(parseInt(String(body?.limit ?? 10), 10) || 10, 1), 50);
      const runnerId = `tick:${randomUUID().slice(0, 8)}`;

      let recovered = { count: 0, requeued: 0, deadLettered: 0 };
      let scheduled = { dueSchedules: 0, jobsEnqueued: 0 };
      let runResult = { claimed: 0, succeeded: 0, retried: 0, failed: 0, deadLettered: 0, canceled: 0 };

      if (recoverStale) {
        recovered = await recoverStaleRunningJobs({ staleAfterMinutes: 10 });
      }

      if (enqueueSchedules) {
        scheduled = await enqueueDueSchedules({ now: new Date(), limit: 20 });
      }

      if (run) {
        runResult = await runJobsLoopOnce({ limit, runnerId });
      }

      return NextResponse.json({
        ok: true,
        runnerId,
        recovered: {
          count: recovered.count,
          deadLettered: recovered.deadLettered,
          requeued: recovered.requeued,
        },
        scheduled: {
          dueSchedules: scheduled.dueSchedules,
          jobsEnqueued: scheduled.jobsEnqueued,
        },
        run: {
          claimed: runResult.claimed,
          succeeded: runResult.succeeded,
          retried: runResult.retried,
          failed: runResult.failed,
          deadLettered: runResult.deadLettered,
          canceled: runResult.canceled,
        },
      });
    } catch (err) {
      console.error("[jobs/tick]", err);
      return jsonError("Failed to tick", 500);
    }
  });
}
