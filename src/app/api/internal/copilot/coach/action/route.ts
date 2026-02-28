/**
 * Phase 5.2: POST /api/internal/copilot/coach/action — Execute or preview coach actions.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { getRequestClientKey, rateLimitByKey } from "@/lib/http/rate-limit";
import { logOpsEventSafe } from "@/lib/ops-events/log";
import { sanitizeErrorMessage, sanitizeMeta } from "@/lib/ops-events/sanitize";
import {
  runCoachAction,
  COACH_ACTION_KEYS,
  NBA_ACTION_KEYS,
  type CoachActionKey,
} from "@/lib/copilot/coach-actions";
import type { CoachFetchOptions } from "@/lib/copilot/coach-tools";
import { addActionLog, addMessage, getSession } from "@/lib/copilot/session-service";
import { ingestFromCopilotActionLog } from "@/lib/memory/ingest";
import {
  loadAttributionContext,
  computeAttributionDelta,
  recordAttribution,
  deltaToOutcome,
} from "@/lib/memory/attribution";

export const dynamic = "force-dynamic";

const BODY_SCHEMA = z.object({
  actionKey: z.enum(COACH_ACTION_KEYS as unknown as [string, ...string[]]),
  mode: z.enum(["preview", "execute"]),
  entityType: z.string().default("command_center"),
  entityId: z.string().default("command_center"),
  sessionId: z.string(), // Phase 5.3: required for action persistence
  nextActionId: z.string().optional(),
  nbaActionKey: z.enum(NBA_ACTION_KEYS as unknown as [string, ...string[]]).optional(),
});

export async function POST(request: NextRequest) {
  return withRouteTiming("POST /api/internal/copilot/coach/action", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const userId = session.user?.id;
    if (!userId) return jsonError("Unauthorized", 401);

    const clientKey = getRequestClientKey(request, userId);
    const rl = rateLimitByKey({ key: `rl:copilot-coach-action:${clientKey}`, windowMs: 60_000, max: 30 });
    if (!rl.ok) {
      const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
      return jsonError("Rate limit exceeded. Try again in a minute.", 429, undefined, {
        headers: { "Retry-After": String(retryAfter) },
      });
    }

    let body: z.infer<typeof BODY_SCHEMA>;
    try {
      const raw = await request.json();
      body = BODY_SCHEMA.parse(raw);
    } catch (e) {
      return jsonError("Invalid body: actionKey and mode required", 400);
    }

    if (body.actionKey === "nba_execute" && (!body.nextActionId || !body.nbaActionKey)) {
      return jsonError("nextActionId and nbaActionKey required for nba_execute", 400);
    }

    const copilotSession = await getSession(body.sessionId);
    if (!copilotSession) {
      return jsonError("Session not found", 404);
    }

    const baseUrl = request.nextUrl.origin;
    const cookie = request.headers.get("cookie") ?? undefined;
    const opts: CoachFetchOptions = { baseUrl, cookie };

    // nba_execute attribution is captured inside runDeliveryAction
    const COPILOT_ATTRIBUTION_ACTIONS = ["run_risk_rules", "run_next_actions", "recompute_score"];
    const captureAttribution =
      body.mode === "execute" && COPILOT_ATTRIBUTION_ACTIONS.includes(body.actionKey);
    let beforeCtx: Awaited<ReturnType<typeof loadAttributionContext>> | null = null;
    if (captureAttribution) {
      beforeCtx = await loadAttributionContext(userId, {
        entityType: body.entityType,
        entityId: body.entityId,
      });
    }

    try {
      const result = await runCoachAction(
        {
          actionKey: body.actionKey as CoachActionKey,
          mode: body.mode,
          entityType: body.entityType,
          entityId: body.entityId,
          nextActionId: body.nextActionId,
          nbaActionKey: body.nbaActionKey,
        },
        opts,
        userId
      );

      if (body.mode === "preview") {
        logOpsEventSafe({
          category: "api_action",
          eventKey: "copilot.coach.action.previewed",
          meta: sanitizeMeta({
            actionKey: body.actionKey,
            mode: body.mode,
            entityType: body.entityType,
            entityId: body.entityId,
            nextActionId: body.nextActionId,
          }),
        });
      } else {
        let attributionId: string | undefined;
        if (beforeCtx && result.ok) {
          try {
            const afterCtx = await loadAttributionContext(userId, {
              entityType: body.entityType,
              entityId: body.entityId,
            });
            const delta = computeAttributionDelta(beforeCtx, afterCtx);
            attributionId = await recordAttribution({
              actorUserId: userId,
              sourceType: "copilot_action",
              ruleKey: body.actionKey,
              actionKey: body.actionKey,
              entityType: body.entityType,
              entityId: body.entityId,
              before: beforeCtx,
              after: afterCtx,
              delta,
              metaJson: { sessionId: body.sessionId },
            });
          } catch (_) {
            // Non-blocking
          }
        }
        const actionLog = await addActionLog(body.sessionId, {
          actionKey: body.actionKey,
          mode: body.mode,
          nextActionId: body.nextActionId,
          nbaActionKey: body.nbaActionKey,
          beforeJson: result.before,
          afterJson: result.after,
          resultJson: { ...result.execution, attributionId },
          status: result.ok ? "success" : "failed",
          errorMessage: result.execution?.errors?.[0],
        });
        ingestFromCopilotActionLog(actionLog.id, userId).catch(() => {});
        await addMessage(body.sessionId, "coach", {
          actionResult: result,
          summary: result.execution?.resultSummary,
          before: result.before,
          after: result.after,
        });
        logOpsEventSafe({
          category: "api_action",
          eventKey: result.ok ? "copilot.coach.action.executed" : "copilot.coach.action.failed",
          status: result.ok ? "success" : "failure",
          meta: sanitizeMeta({
            actionKey: body.actionKey,
            mode: body.mode,
            entityType: body.entityType,
            entityId: body.entityId,
            nextActionId: body.nextActionId,
            ok: result.ok,
          }),
          errorMessage: result.ok ? undefined : result.execution?.errors?.[0],
        });
      }

      return NextResponse.json(result);
    } catch (err) {
      const msg = sanitizeErrorMessage(err);
      console.error("[copilot/coach/action]", err);
      logOpsEventSafe({
        category: "api_action",
        eventKey: "copilot.coach.action.failed",
        status: "failure",
        errorMessage: msg,
        meta: sanitizeMeta({
          actionKey: body.actionKey,
          mode: body.mode,
        }),
      });
      return jsonError(msg || "Action failed", 500);
    }
  });
}
