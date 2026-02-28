/**
 * Phase 8.0: GET /api/internal/retention/context — Unified Retention domain context.
 * Aggregates: retention summary, NBA (retention_overdue), risk (retention_overdue).
 * Surfaces retention_overdue where operators need it.
 */
import { NextRequest } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { db } from "@/lib/db";
import { withSummaryCache } from "@/lib/http/cached-handler";
import { RiskStatus, NextActionStatus } from "@prisma/client";
import { classifyRetentionBucket, computeRetentionStale } from "@/lib/delivery/retention";

export const dynamic = "force-dynamic";

const RETENTION_NBA_RULES = ["retention_overdue"];
const RETENTION_RISK_RULES = ["retention_overdue"];

export async function GET(request: NextRequest) {
  return withRouteTiming("GET /api/internal/retention/context", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    try {
      return await withSummaryCache("retention/context", async () => {
        const now = new Date();

        const [projects, riskFlags, nbaActions] = await Promise.all([
          db.deliveryProject.findMany({
            where: { status: { in: ["completed", "archived"] } },
            select: {
              id: true,
              retentionStatus: true,
              retentionNextFollowUpAt: true,
              testimonialRequestedAt: true,
              testimonialReceivedAt: true,
              reviewRequestedAt: true,
              reviewReceivedAt: true,
              referralRequestedAt: true,
              referralReceivedAt: true,
            },
          }),
          db.riskFlag.findMany({
            where: {
              status: RiskStatus.open,
              createdByRule: { in: RETENTION_RISK_RULES },
            },
            orderBy: [{ severity: "desc" }, { lastSeenAt: "desc" }],
            take: 5,
            select: { id: true, title: true, severity: true, createdByRule: true },
          }),
          db.nextBestAction.findMany({
            where: {
              entityType: { in: ["command_center", "review_stream"] },
              entityId: { in: ["command_center", "review_stream"] },
              status: NextActionStatus.queued,
              createdByRule: { in: RETENTION_NBA_RULES },
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

        let dueToday = 0;
        let overdue = 0;
        let upcoming = 0;
        let testimonialRequested = 0;
        let testimonialReceived = 0;
        let reviewRequested = 0;
        let reviewReceived = 0;
        let referralRequested = 0;
        let referralReceived = 0;
        let retainerOpen = 0;
        let upsellOpen = 0;
        let closedWon = 0;
        let closedLost = 0;
        let stalePostDelivery = 0;

        for (const p of projects) {
          const bucket = classifyRetentionBucket(p.retentionNextFollowUpAt, now);
          if (bucket === "overdue") overdue++;
          else if (bucket === "today") dueToday++;
          else if (bucket === "upcoming") upcoming++;

          if (p.testimonialRequestedAt) testimonialRequested++;
          if (p.testimonialReceivedAt) testimonialReceived++;
          if (p.reviewRequestedAt) reviewRequested++;
          if (p.reviewReceivedAt) reviewReceived++;
          if (p.referralRequestedAt) referralRequested++;
          if (p.referralReceivedAt) referralReceived++;

          const status = (p.retentionStatus ?? "none").toString();
          if (status === "retainer_open") retainerOpen++;
          else if (status === "upsell_open") upsellOpen++;
          else if (status === "closed_won") closedWon++;
          else if (status === "closed_lost") closedLost;

          const { isStale } = computeRetentionStale(p);
          if (isStale) stalePostDelivery++;
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
          summary: {
            dueToday,
            overdue,
            upcoming,
            testimonialRequested,
            testimonialReceived,
            reviewRequested,
            reviewReceived,
            referralRequested,
            referralReceived,
            retainerOpen,
            upsellOpen,
            closedWon,
            closedLost,
            stalePostDelivery,
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
      console.error("[retention/context]", err);
      return jsonError(sanitizeErrorMessage(err), 500);
    }
  });
}
