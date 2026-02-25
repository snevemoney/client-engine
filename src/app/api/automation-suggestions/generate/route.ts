/**
 * POST /api/automation-suggestions/generate — Generate suggestions from current state.
 * Idempotent: avoid duplicate pending (same type+sourceId).
 * Optional async: body.async=true or ?async=1 enqueues job and returns 202.
 */
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { getRequestClientKey, rateLimitByKey } from "@/lib/http/rate-limit";
import { generateAutomationSuggestionsService } from "@/lib/automation-suggestions/generate-service";
import { enqueueJob } from "@/lib/jobs/enqueue";

export const dynamic = "force-dynamic";

function wantsAsync(request: NextRequest): boolean {
  const url = new URL(request.url);
  if (url.searchParams.get("async") === "1") return true;
  return false;
}

export async function POST(request: NextRequest) {
  return withRouteTiming("POST /api/automation-suggestions/generate", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const clientKey = getRequestClientKey(request, session?.user?.id);
    const rl = rateLimitByKey({ key: `rl:automation-generate:${clientKey}`, windowMs: 60_000, max: 10 });
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
      const dedupeKey = `generate_automation_suggestions:${session.user?.id ?? "anon"}`;
      const result = await enqueueJob({
        jobType: "generate_automation_suggestions",
        dedupeKey,
        sourceType: "automation_suggestions",
        createdByUserId: session.user?.id,
      });
      return NextResponse.json(
        { ok: true, queued: true, jobId: result.id, status: result.status },
        { status: 202 }
      );
    }

    try {
      const result = await generateAutomationSuggestionsService();
      return NextResponse.json(result);
    } catch (err) {
      console.error("[automation-suggestions generate]", err);
      return jsonError("Failed to generate suggestions", 500);
    }
  });
}
