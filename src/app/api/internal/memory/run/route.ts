/**
 * Phase 7.2: POST /api/internal/memory/run — Run policy engine, raise pattern risks, optionally auto-apply.
 * Rate limit 5/min.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { getRequestClientKey, rateLimitByKey } from "@/lib/http/rate-limit";
import {
  computeWindowStats,
  computeTrendDiffs,
  derivePolicySuggestions,
  buildPatternAlerts,
} from "@/lib/memory/policy";
import { createOrUpdatePatternRiskFlag } from "@/lib/memory/alerts";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

const AUTO_APPLY_ENABLED = process.env.MEMORY_AUTO_APPLY_SUPPRESSIONS === "1";
const AUTO_APPLY_MIN_CONFIDENCE = Math.min(
  1,
  Math.max(0, parseFloat(process.env.MEMORY_AUTO_APPLY_MIN_CONFIDENCE ?? "0.8") || 0.8)
);

export async function POST(request: NextRequest) {
  return withRouteTiming("POST /api/internal/memory/run", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const userId = session.user?.id;
    if (!userId) return jsonError("Unauthorized", 401);

    const clientKey = getRequestClientKey(request, userId);
    const rl = rateLimitByKey({ key: `rl:memory-run:${clientKey}`, windowMs: 60_000, max: 5 });
    if (!rl.ok) {
      const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
      return jsonError("Rate limit exceeded. Try again in a minute.", 429, undefined, {
        headers: { "Retry-After": String(retryAfter), "Cache-Control": "private, no-store" },
        bodyExtra: { retryAfterSeconds: retryAfter },
      });
    }

    const days = 7;
    const since = daysAgo(days);
    const priorSince = daysAgo(days * 2);

    try {
      const [currentStats, priorStats] = await Promise.all([
        computeWindowStats(userId, since, new Date()),
        computeWindowStats(userId, priorSince, since),
      ]);

      const diffs = computeTrendDiffs(currentStats, priorStats);
      const suggestions = derivePolicySuggestions(currentStats, diffs);
      const patternAlerts = buildPatternAlerts(suggestions);

      const riskFlagIds: string[] = [];
      for (const alert of patternAlerts) {
        const { riskFlagId } = await createOrUpdatePatternRiskFlag({
          actorUserId: userId,
          ruleKey: alert.ruleKey,
          severity: alert.severity,
          dedupeKey: alert.dedupeKey,
          title: alert.title,
          description: alert.description,
        });
        riskFlagIds.push(riskFlagId);
      }

      const appliedSuppressions: string[] = [];
      if (AUTO_APPLY_ENABLED) {
        const suppressionSuggestions = suggestions.filter(
          (s) => s.type === "suppression_30d" && s.confidence >= AUTO_APPLY_MIN_CONFIDENCE
        );
        for (const s of suppressionSuggestions) {
          const entityType = "command_center";
          const entityId = "command_center";
          const suppressedUntil = new Date();
          suppressedUntil.setDate(suppressedUntil.getDate() + 30);

          const existing = await db.nextActionPreference.findFirst({
            where: { entityType, entityId, ruleKey: s.ruleKey },
          });

          if (existing) {
            await db.nextActionPreference.update({
              where: { id: existing.id },
              data: { status: "active", suppressedUntil, reason: "Memory policy: auto-applied" },
            });
          } else {
            await db.nextActionPreference.create({
              data: {
                entityType,
                entityId,
                ruleKey: s.ruleKey,
                status: "active",
                suppressedUntil,
                reason: "Memory policy: auto-applied",
              },
            });
          }
          appliedSuppressions.push(s.ruleKey);
        }
      }

      return NextResponse.json({
        ok: true,
        patternAlertsRaised: patternAlerts.length,
        riskFlagIds,
        autoApplyEnabled: AUTO_APPLY_ENABLED,
        appliedSuppressions: AUTO_APPLY_ENABLED ? appliedSuppressions : undefined,
      });
    } catch (err) {
      console.error("[memory/run]", err);
      return jsonError(sanitizeErrorMessage(err), 500);
    }
  });
}
