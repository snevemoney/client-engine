/**
 * POST /api/metrics/snapshot — Compute current weekly metrics and upsert into WeeklyMetricSnapshot.
 * Idempotent per week+metricKey. Returns count of metrics written.
 * Optional async: body.async=true or ?async=1 enqueues job and returns 202.
 */
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { getRequestClientKey, rateLimitByKey } from "@/lib/http/rate-limit";
import { captureMetricsSnapshot } from "@/lib/metrics/snapshot-service";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { getWeekStart } from "@/lib/ops/weekStart";

export const dynamic = "force-dynamic";

function wantsAsync(request: NextRequest): boolean {
  const url = new URL(request.url);
  return url.searchParams.get("async") === "1";
}

export async function POST(request: NextRequest) {
  return withRouteTiming("POST /api/metrics/snapshot", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const clientKey = getRequestClientKey(request, session?.user?.id);
    const rl = rateLimitByKey({ key: `rl:metrics-snapshot:${clientKey}`, windowMs: 60_000, max: 5 });
    if (!rl.ok) {
      const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { error: true, message: "Rate limit exceeded", retryAfterSeconds: retryAfter },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    let asyncMode = wantsAsync(request);
    if (!asyncMode) {
      try {
        const body = await request.json().catch(() => ({}));
        asyncMode = body?.async === true;
      } catch {
        /* ignore */
      }
    }

    if (asyncMode) {
      const weekStart = getWeekStart(new Date());
      const dedupeKey = `metrics_snapshot:${weekStart.toISOString().slice(0, 10)}`;
      const result = await enqueueJob({
        jobType: "capture_metrics_snapshot",
        dedupeKey,
        sourceType: "metrics",
        sourceId: weekStart.toISOString().slice(0, 10),
        createdByUserId: session.user?.id,
      });
      return NextResponse.json(
        { ok: true, queued: true, jobId: result.id, status: result.status },
        { status: 202 }
      );
    }

    try {
      const result = await captureMetricsSnapshot();
      return NextResponse.json(result);
    } catch (err) {
      console.error("[metrics/snapshot]", err);
      return jsonError("Failed to capture snapshot", 500);
    }
  });
}
