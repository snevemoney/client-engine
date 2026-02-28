/**
 * Phase 8.0: GET /api/internal/growth/context — Unified Growth domain context.
 * Aggregates: growth summary, NBA (founder_growth), risk (growth-related).
 * Reduces client fetches; surfaces growth_overdue_followups, growth_no_outreach, growth_stale_pipeline.
 */
import { NextRequest } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { db } from "@/lib/db";
import { withSummaryCache } from "@/lib/http/cached-handler";
import { RiskStatus, NextActionStatus } from "@prisma/client";
import { computeGrowthSummary } from "@/lib/growth/summary";

export const dynamic = "force-dynamic";

const GROWTH_RISK_RULES = ["growth_pipeline_zero_activity_7d"];

export async function GET(request: NextRequest) {
  return withRouteTiming("GET /api/internal/growth/context", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const userId = session.user?.id;
    if (!userId) return jsonError("Unauthorized", 401);

    try {
      return await withSummaryCache(
        `growth/context:${userId}`,
        async () => {
          let summary: Awaited<ReturnType<typeof computeGrowthSummary>>;
          try {
            summary = await computeGrowthSummary(userId);
          } catch (e) {
            console.error("[growth/context] computeGrowthSummary failed:", e);
            summary = {
              countsByStage: {},
              overdueFollowUps: [],
              next7DaysFollowUps: [],
              lastActivityAt: null,
            };
          }
          const [riskFlags, nbaActions] = await Promise.all([
            db.riskFlag.findMany({
              where: {
                status: RiskStatus.open,
                createdByRule: { in: GROWTH_RISK_RULES },
              },
              orderBy: [{ severity: "desc" }, { lastSeenAt: "desc" }],
              take: 5,
              select: { id: true, title: true, severity: true, createdByRule: true },
            }),
            db.nextBestAction.findMany({
              where: {
                entityType: "founder_growth",
                entityId: "founder_growth",
                status: NextActionStatus.queued,
              },
              orderBy: [{ score: "desc" }, { createdAt: "desc" }],
              take: 5,
              select: {
                id: true,
                title: true,
                priority: true,
                score: true,
                actionUrl: true,
                templateKey: true,
                createdByRule: true,
              },
            }),
          ]);

          const riskCounts = { critical: 0, high: 0 };
          for (const r of riskFlags) {
            if (r.severity === "critical") riskCounts.critical++;
            else if (r.severity === "high") riskCounts.high++;
          }

          const nbaCounts = { critical: 0, high: 0 };
          for (const a of nbaActions) {
            if (a.priority === "critical") nbaCounts.critical++;
            else if (a.priority === "high") nbaCounts.high++;
          }

          return {
            summary,
            risk: {
              openCount: riskFlags.length,
              criticalCount: riskCounts.critical,
              highCount: riskCounts.high,
              topFlags: riskFlags.map((f) => ({
                id: f.id,
                title: f.title,
                severity: f.severity,
                ruleKey: f.createdByRule ?? f.id,
              })),
            },
            nba: {
              queuedCount: nbaActions.length,
              criticalCount: nbaCounts.critical,
              highCount: nbaCounts.high,
              topActions: nbaActions.map((a) => ({
                id: a.id,
                title: a.title,
                priority: a.priority,
                score: a.score,
                actionUrl: a.actionUrl,
                templateKey: a.templateKey ?? null,
              })),
            },
          };
        },
        15_000
      );
    } catch (err) {
      console.error("[growth/context]", err);
      return jsonError(sanitizeErrorMessage(err), 500);
    }
  });
}
