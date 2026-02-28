/**
 * POST /api/next-actions/run — Run NBA rules and upsert actions.
 * Phase 4.0/4.1. Rate limit 10/min. Accepts optional scope (entityType, entityId).
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { getRequestClientKey, rateLimitByKey } from "@/lib/http/rate-limit";
import { fetchNextActionContext } from "@/lib/next-actions/fetch-context";
import { produceNextActions } from "@/lib/next-actions/rules";
import { filterByPreferences } from "@/lib/next-actions/preferences";
import { loadLearnedWeights } from "@/lib/memory/weights";
import { loadEffectivenessMap } from "@/lib/memory/effectiveness";
import { upsertNextActions, recordNextActionRun } from "@/lib/next-actions/service";
import { parseScope } from "@/lib/next-actions/scope";
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

    const { entityType, entityId } = parseScope(
      request.nextUrl.searchParams.get("entityType"),
      request.nextUrl.searchParams.get("entityId")
    );

    const now = new Date();
    const runKey = `nba:${session.user?.id ?? "anon"}:${entityType}:${entityId}:${now.toISOString().slice(0, 10)}`;

    try {
      const ownerUserId =
        entityType === "founder_growth" ? session.user?.id ?? undefined : undefined;
      const ctx = await fetchNextActionContext({ now, ownerUserId });
      const [learnedWeights, effectivenessByRuleKey] = session.user?.id
        ? await Promise.all([loadLearnedWeights(session.user.id), loadEffectivenessMap(session.user.id)])
        : [undefined, undefined];
      let candidates = produceNextActions(ctx, entityType, learnedWeights, effectivenessByRuleKey);
      candidates = await filterByPreferences(candidates, entityType, entityId);
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
