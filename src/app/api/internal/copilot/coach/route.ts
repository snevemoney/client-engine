/**
 * Phase 5.1: POST /api/internal/copilot/coach — Coach Mode chat.
 * Tool-backed, deterministic. No guessing. Citations required.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { getRequestClientKey, rateLimitByKey } from "@/lib/http/rate-limit";
import { logOpsEventSafe } from "@/lib/ops-events/log";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import {
  getScoreContext,
  getRiskContext,
  getNBAContext,
  type CoachFetchOptions,
} from "@/lib/copilot/coach-tools";
import { deriveCoachResponse } from "@/lib/copilot/coach-engine";
import { CoachResponseSchema } from "@/lib/copilot/coach-schema";
import {
  createSession,
  addMessage,
  getSession,
} from "@/lib/copilot/session-service";

export const dynamic = "force-dynamic";

const BODY_SCHEMA = z.object({
  message: z.string().min(1).max(2000),
  entityType: z.string().default("command_center"),
  entityId: z.string().default("command_center"),
  sessionId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  return withRouteTiming("POST /api/internal/copilot/coach", async () => {
    logOpsEventSafe({
      category: "api_action",
      eventKey: "copilot.coach.requested",
      route: "/api/internal/copilot/coach",
      method: "POST",
    });

    const session = await requireAuth();
    if (!session) {
      logOpsEventSafe({
        category: "api_action",
        eventKey: "copilot.coach.failed",
        status: "failure",
        errorMessage: "Unauthorized",
      });
      return jsonError("Unauthorized", 401);
    }

    const clientKey = getRequestClientKey(request, session.user?.id);
    const rl = rateLimitByKey({ key: `rl:copilot-coach:${clientKey}`, windowMs: 60_000, max: 20 });
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
      return jsonError("Invalid body: message required", 400);
    }

    const { entityType, entityId, sessionId: bodySessionId } = body;
    const baseUrl = request.nextUrl.origin;
    const cookie = request.headers.get("cookie") ?? undefined;
    const opts: CoachFetchOptions = { baseUrl, cookie };

    try {
      let sessionId = bodySessionId;
      if (!sessionId) {
        const session = await createSession({ entityType, entityId });
        sessionId = session.id;
      } else {
        const existing = await getSession(sessionId);
        if (!existing) {
          return jsonError("Session not found", 404);
        }
      }

      const [score, risk, nba] = await Promise.all([
        getScoreContext(entityType, entityId, opts),
        getRiskContext(entityType, entityId, opts),
        getNBAContext(entityType, entityId, opts),
      ]);

      logOpsEventSafe({
        category: "api_action",
        eventKey: "copilot.coach.context_loaded",
        meta: {
          scoreOk: !score.error,
          riskOk: !risk.error,
          nbaOk: !nba.error,
        },
      });

      const response = deriveCoachResponse(body.message, { score, risk, nba });
      const parsed = CoachResponseSchema.safeParse(response);
      const output = parsed.success ? parsed.data : response;

      await addMessage(sessionId, "user", { message: body.message });
      const allSources = output.reply?.topActions?.flatMap((a) => a.sources ?? []) ?? [];
      await addMessage(sessionId, "coach", output, allSources.length ? allSources : undefined);

      logOpsEventSafe({
        category: "api_action",
        eventKey: "copilot.coach.responded",
      });

      return NextResponse.json({ ...output, sessionId });
    } catch (err) {
      const msg = sanitizeErrorMessage(err);
      console.error("[copilot/coach]", err);
      logOpsEventSafe({
        category: "api_action",
        eventKey: "copilot.coach.failed",
        status: "failure",
        errorMessage: msg,
      });
      return jsonError(msg || "Coach request failed", 500);
    }
  });
}
