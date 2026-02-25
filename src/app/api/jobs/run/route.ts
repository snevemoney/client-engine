/**
 * POST /api/jobs/run — Run one queue pass manually (auth + rate limit).
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { getRequestClientKey, rateLimitByKey } from "@/lib/http/rate-limit";
import { runJobsLoopOnce } from "@/lib/jobs/runner";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return withRouteTiming("POST /api/jobs/run", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const clientKey = getRequestClientKey(request, session?.user?.id);
    const rl = rateLimitByKey({ key: `rl:jobs-run:${clientKey}`, windowMs: 60_000, max: 10 });
    if (!rl.ok) {
      const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { error: true, message: "Rate limit exceeded", retryAfterSeconds: retryAfter },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    try {
      const body = await request.json().catch(() => ({}));
      const limit = Math.min(Math.max(parseInt(String(body?.limit ?? 10), 10) || 10, 1), 50);
      const runnerId = `runner:${randomUUID().slice(0, 8)}`;

      const { recoverStaleRunningJobs } = await import("@/lib/jobs/recovery");
      await recoverStaleRunningJobs({ staleAfterMinutes: 10 });

      const result = await runJobsLoopOnce({ limit, runnerId });

      return NextResponse.json({
        ok: true,
        claimed: result.claimed,
        succeeded: result.succeeded,
        failed: result.failed,
        retried: result.retried,
        deadLettered: result.deadLettered,
        canceled: result.canceled,
        runnerId: result.runnerId,
      });
    } catch (err) {
      console.error("[jobs/run]", err);
      return jsonError("Failed to run jobs", 500);
    }
  });
}
