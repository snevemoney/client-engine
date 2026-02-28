/**
 * Phase 7.1/7.2: GET /api/internal/memory/summary — Pattern learning summary + trend diffs + pattern alerts.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { db } from "@/lib/db";
import { withSummaryCache } from "@/lib/http/cached-handler";
import { OperatorMemorySourceType } from "@prisma/client";
import {
  computeWindowStats,
  computeTrendDiffs,
  derivePolicySuggestions,
  buildPatternAlerts,
} from "@/lib/memory/policy";
import { computeEffectiveness } from "@/lib/memory/effectiveness";

export const dynamic = "force-dynamic";

type Range = "7d" | "30d";

function parseRange(s: string | null): Range {
  return s === "30d" ? "30d" : "7d";
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

export async function GET(request: NextRequest) {
  return withRouteTiming("GET /api/internal/memory/summary", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const userId = session.user?.id;
    if (!userId) return jsonError("Unauthorized", 401);

    const range = parseRange(request.nextUrl.searchParams.get("range"));
    const days = range === "30d" ? 30 : 7;
    const since = daysAgo(days);
    const priorSince = daysAgo(days * 2);

    try {
      return await withSummaryCache(
        `memory/summary:${userId}:${range}`,
        async () => {
          const [currentStats, priorStats, weights, riskFlags] = await Promise.all([
            computeWindowStats(userId, since, new Date()),
            computeWindowStats(userId, priorSince, since),
            db.operatorLearnedWeight.findMany({
              where: { actorUserId: userId, kind: "rule" },
              select: { key: true, weight: true, statsJson: true, updatedAt: true },
            }),
            db.riskFlag.findMany({
              where: { key: { startsWith: "pattern:" }, status: "open" },
              select: { id: true, key: true },
            }),
          ]);

          const diffs = computeTrendDiffs(currentStats, priorStats);
          const suggestions = derivePolicySuggestions(currentStats, diffs);
          const patternAlerts = buildPatternAlerts(suggestions);

          const dismissCountByRule: Record<string, number> = {};
          for (const [rk, s] of Object.entries(currentStats.byRuleKey)) {
            if (s.dismiss > 0) dismissCountByRule[rk] = s.dismiss;
          }
          const effectiveness = await computeEffectiveness(userId, since, new Date(), dismissCountByRule);

          const suppressionSuggestions = suggestions
            .filter((s) => s.type === "suppression_30d")
            .map((s) => ({
              type: s.type,
              ruleKey: s.ruleKey,
              confidence: s.confidence,
              reasons: s.reasons,
              evidence: s.evidence,
            }));

          const alertsWithRisk = patternAlerts.map((a) => {
            const riskKey = `pattern:${a.ruleKey}`;
            const riskExists = riskFlags.some((r) => r.key === riskKey);
            return {
              ...a,
              riskFlagExists: riskExists,
            };
          });

          const lastUpdated = weights.sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          )[0]?.updatedAt;

          const ruleCounts: Record<string, number> = {};
          const ruleSuccess: Record<string, number> = {};
          const ruleDismiss: Record<string, number> = {};
          for (const [rk, s] of Object.entries(currentStats.byRuleKey)) {
            ruleCounts[rk] = s.total;
            if (s.executeSuccess > 0) ruleSuccess[rk] = s.executeSuccess;
            if (s.dismiss > 0) ruleDismiss[rk] = s.dismiss;
          }

          const topRecurringRuleKeys = Object.entries(ruleCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([key, count]) => ({
              ruleKey: key,
              count,
              trend: (priorStats.byRuleKey[key]?.total ?? 0) - count,
            }));

          const topSuccessfulRuleKeys = Object.entries(ruleSuccess)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([ruleKey, count]) => ({ ruleKey, count }));

          const topDismissedRuleKeys = Object.entries(ruleDismiss)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([ruleKey, count]) => ({ ruleKey, count }));

          const suggestedSuppressions = suppressionSuggestions.map((s) => ({
            ruleKey: s.ruleKey,
            confidence: s.confidence,
            reasons: s.reasons,
            dismissCount: (s.evidence.find((e) => e.key === "dismissCount")?.value as number) ?? 0,
            dismissRate: 0,
          }));

          for (const s of suggestedSuppressions) {
            const total = ruleCounts[s.ruleKey] ?? 0;
            s.dismissRate = total > 0 ? (s.dismissCount / total) : 0;
          }

          const attributionTotals = await db.operatorAttribution.count({
            where: { actorUserId: userId, occurredAt: { gte: since, lt: new Date() } },
          });

          return {
            topRecurringRuleKeys,
            topSuccessfulRuleKeys,
            topDismissedRuleKeys,
            suggestedSuppressions,
            trendDiffs: diffs,
            patternAlerts: alertsWithRisk,
            policySuggestions: suppressionSuggestions,
            topEffectiveRuleKeys: effectiveness.topEffectiveRuleKeys,
            topNoisyRuleKeys: effectiveness.topNoisyRuleKeys,
            effectiveness: {
              byRuleKey: Object.values(effectiveness.byRuleKey)
                .sort((a, b) => b.netLiftScore - a.netLiftScore)
                .slice(0, 20),
            },
            attributionTotals: { count: attributionTotals },
            lastUpdatedAt: lastUpdated?.toISOString() ?? null,
            range,
          };
        },
        15_000
      );
    } catch (err) {
      console.error("[memory/summary]", err);
      return jsonError(sanitizeErrorMessage(err), 500);
    }
  });
}
