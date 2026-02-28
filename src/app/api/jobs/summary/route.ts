/**
 * GET /api/jobs/summary — Job queue summary for Command Center / Jobs page.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { swrCacheHeaders } from "@/lib/http/response";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/jobs/summary", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const staleThreshold = new Date(Date.now() - 10 * 60 * 1000);

    const [
      queued,
      running,
      failed,
      deadLetter,
      succeeded24h,
      latestFailed,
      staleRunning,
      dueSchedules,
    ] = await Promise.all([
      db.jobRun.count({ where: { status: "queued" } }),
      db.jobRun.count({ where: { status: "running" } }),
      db.jobRun.count({ where: { status: "failed" } }),
      db.jobRun.count({ where: { status: "dead_letter" } }),
      db.jobRun.count({ where: { status: "succeeded", finishedAt: { gte: dayAgo } } }),
      db.jobRun.findFirst({
        where: { status: { in: ["failed", "dead_letter"] } },
        orderBy: { finishedAt: "desc" },
        select: { jobType: true },
      }),
      db.jobRun.count({
        where: {
          status: "running",
          OR: [
            { lockedAt: { lt: staleThreshold } },
            { lockedAt: null, startedAt: { lt: staleThreshold } },
          ],
        },
      }),
      db.jobSchedule.count({
        where: { isEnabled: true, nextRunAt: { lte: new Date() } },
      }),
    ]);

    return NextResponse.json({
      queued: queued ?? 0,
      running: running ?? 0,
      failed: failed ?? 0,
      deadLetter: deadLetter ?? 0,
      succeeded24h: succeeded24h ?? 0,
      latestFailedJobType: latestFailed?.jobType ?? null,
      staleRunning: staleRunning ?? 0,
      dueSchedules: dueSchedules ?? 0,
    }, { headers: swrCacheHeaders(15, 60) });
  });
}
