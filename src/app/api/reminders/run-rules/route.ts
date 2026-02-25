/**
 * POST /api/reminders/run-rules — Scan data and upsert reminders from rules.
 * Idempotent: no duplicate open reminders for same source+kind.
 * Optional async: body.async=true or ?async=1 enqueues job and returns 202.
 */
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { getRequestClientKey, rateLimitByKey } from "@/lib/http/rate-limit";
import { runReminderRules } from "@/lib/reminders/run-rules-service";
import { enqueueJob } from "@/lib/jobs/enqueue";

export const dynamic = "force-dynamic";

function wantsAsync(request: NextRequest): boolean {
  const url = new URL(request.url);
  if (url.searchParams.get("async") === "1") return true;
  return false;
}

export async function POST(request: NextRequest) {
  return withRouteTiming("POST /api/reminders/run-rules", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const clientKey = getRequestClientKey(request, session?.user?.id);
    const rl = rateLimitByKey({ key: `rl:reminders-run-rules:${clientKey}`, windowMs: 60_000, max: 10 });
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
      const dedupeKey = `run_reminder_rules:${session.user?.id ?? "anon"}`;
      const result = await enqueueJob({
        jobType: "run_reminder_rules",
        dedupeKey,
        sourceType: "reminders",
        createdByUserId: session.user?.id,
      });
      return NextResponse.json(
        { ok: true, queued: true, jobId: result.id, status: result.status },
        { status: 202 }
      );
    }

    try {
      const result = await runReminderRules();
      return NextResponse.json(result);
    } catch (err) {
      console.error("[reminders/run-rules]", err);
      return jsonError("Failed to run rules", 500);
    }
  });
}
