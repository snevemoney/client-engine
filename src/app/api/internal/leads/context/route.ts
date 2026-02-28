/**
 * Phase 8.0: GET /api/internal/leads/context — Unified Leads domain context.
 * Aggregates: pipeline snapshot, NBA (flywheel_stage_stall, flywheel_referral_gap, flywheel_won_no_delivery), risk.
 * Surfaces stage_stall, referral_gap, won_no_delivery where operators need them.
 */
import { NextRequest } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { db } from "@/lib/db";
import { withSummaryCache } from "@/lib/http/cached-handler";
import { RiskStatus, NextActionStatus, LeadStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const LEADS_NBA_RULES = ["flywheel_stage_stall", "flywheel_referral_gap", "flywheel_won_no_delivery"];

export async function GET(request: NextRequest) {
  return withRouteTiming("GET /api/internal/leads/context", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    try {
      return await withSummaryCache("leads/context", async () => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const activeWhere = {
          status: { notIn: [LeadStatus.REJECTED, LeadStatus.SHIPPED] },
          dealOutcome: { not: "won" },
        };

        const [
          byStage,
          stuckOver7d,
          noNextStep,
          wonNoDelivery,
          riskFlags,
          nbaActions,
        ] = await Promise.all([
          db.lead.groupBy({
            by: ["status"],
            where: activeWhere,
            _count: { id: true },
          }),
          db.lead.count({
            where: {
              ...activeWhere,
              OR: [
                { lastContactAt: { lt: sevenDaysAgo } },
                { AND: [{ updatedAt: { lt: sevenDaysAgo } }, { lastContactAt: null }] },
              ],
            },
          }),
          db.lead.count({
            where: {
              ...activeWhere,
              OR: [
                { nextAction: null },
                { nextAction: "" },
                { nextActionDueAt: null },
              ],
            },
          }),
          db.lead.count({
            where: {
              status: LeadStatus.SHIPPED,
              dealOutcome: "won",
              deliveryProjects: { none: {} },
            },
          }),
          db.riskFlag.findMany({
            where: { status: RiskStatus.open },
            orderBy: [{ severity: "desc" }, { lastSeenAt: "desc" }],
            take: 5,
            select: { id: true, title: true, severity: true, createdByRule: true },
          }),
          db.nextBestAction.findMany({
            where: {
              entityType: "command_center",
              entityId: "command_center",
              status: NextActionStatus.queued,
              createdByRule: { in: LEADS_NBA_RULES },
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
            },
          }),
        ]);

        const byStageMap: Record<string, number> = {};
        for (const g of byStage) {
          byStageMap[g.status] = g._count.id;
        }

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
          pipeline: {
            byStage: byStageMap,
            stuckOver7d,
            noNextStep,
            wonNoDelivery,
          },
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
      }, 15_000);
    } catch (err) {
      console.error("[leads/context]", err);
      return jsonError(sanitizeErrorMessage(err), 500);
    }
  });
}
