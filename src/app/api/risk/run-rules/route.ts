/**
 * POST /api/risk/run-rules — Evaluate risk rules and upsert flags.
 * Phase 4.0. Rate limit 10/min.
 */
import { NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { getRequestClientKey, rateLimitByKey } from "@/lib/http/rate-limit";
import { fetchRiskRuleContext } from "@/lib/risk/fetch-context";
import { evaluateRiskRules } from "@/lib/risk/rules";
import { upsertRiskFlags } from "@/lib/risk/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withRouteTiming("POST /api/risk/run-rules", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const clientKey = getRequestClientKey(request, session.user?.id);
    const rl = rateLimitByKey({ key: `rl:risk-run-rules:${clientKey}`, windowMs: 60_000, max: 10 });
    if (!rl.ok) {
      const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
      return jsonError("Rate limit exceeded. Try again in a minute.", 429, undefined, {
        headers: { "Retry-After": String(retryAfter), "Cache-Control": "private, no-store" },
        bodyExtra: { retryAfterSeconds: retryAfter },
      });
    }

    try {
      const ctx = await fetchRiskRuleContext();
      const candidates = evaluateRiskRules(ctx);
      const result = await upsertRiskFlags(candidates);

      return NextResponse.json({
        created: result.created,
        updated: result.updated,
        criticalNotified: result.criticalNotified,
        lastRunAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[risk/run-rules]", err);
      return jsonError(sanitizeErrorMessage(err) || "Failed to run risk rules", 500);
    }
  });
}
