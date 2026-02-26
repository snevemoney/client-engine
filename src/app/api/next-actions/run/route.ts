/**
 * POST /api/next-actions/run — Run NBA rules and upsert actions.
 * Phase 4.0. Rate limit 10/min.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { getRequestClientKey, rateLimitByKey } from "@/lib/http/rate-limit";
import { fetchNextActionContext } from "@/lib/next-actions/fetch-context";
import { produceNextActions } from "@/lib/next-actions/rules";
import { upsertNextActions, recordNextActionRun } from "@/lib/next-actions/service";
import { logOpsEventSafe } from "@/lib/ops-events/log";
import { sanitizeMeta, sanitizeErrorMessage } from "@/lib/ops-events/sanitize";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return withRouteTiming("POST /api/next-actions/run", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const clientKey = getRequestClientKey(request, session.user?.id);
    const rl = rateLimitByKey({ key: `rl:next-actions-run:${clientKey}`, windowMs: 60_000, max: 10 });
    if (!rl.ok) {
      const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
      return jsonError("Rate limit exceeded. Try again in a minute.", 429, undefined, {
        headers: { "Retry-After": String(retryAfter), "Cache-Control": "private, no-store" },
        bodyExtra: { retryAfterSeconds: retryAfter },
      });
    }

    const now = new Date();
    const runKey = `nba:${session.user?.id ?? "anon"}:${now.toISOString().slice(0, 10)}`;

    try {
      const ctx = await fetchNextActionContext({ now });
      const candidates = produceNextActions(ctx);
      const result = await upsertNextActions(candidates);
      await recordNextActionRun(runKey, "manual", {
        created: result.created,
        updated: result.updated,
        candidateCount: candidates.length,
      });

      logOpsEventSafe({
        category: "system",
        eventKey: "nba.run",
        meta: sanitizeMeta({ created: result.created, updated: result.updated }),
      });

      return NextResponse.json({
        created: result.created,
        updated: result.updated,
        runKey,
        lastRunAt: now.toISOString(),
      });
    } catch (err) {
      console.error("[next-actions/run]", err);
      return jsonError(sanitizeErrorMessage(err) || "Failed to run next actions", 500);
    }
  });
}
