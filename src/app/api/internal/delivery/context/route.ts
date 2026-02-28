/**
 * Phase 8.0: GET /api/internal/delivery/context — Unified Delivery domain context.
 * Aggregates: delivery summary, handoff summary, NBA (handoff_no_client_confirm, retention_overdue), risk.
 * Surfaces handoff_no_client_confirm, retention_overdue where operators need them.
 */
import { NextRequest } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { db } from "@/lib/db";
import { withSummaryCache } from "@/lib/http/cached-handler";
import { RiskStatus, NextActionStatus } from "@prisma/client";
import { getWeekStart } from "@/lib/ops/weekStart";
import { computeProjectHealth } from "@/lib/delivery/readiness";

export const dynamic = "force-dynamic";

const DELIVERY_NBA_RULES = ["handoff_no_client_confirm", "retention_overdue"];
const DELIVERY_RISK_RULES = ["retention_overdue"];

export async function GET(request: NextRequest) {
  return withRouteTiming("GET /api/internal/delivery/context", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    try {
      return await withSummaryCache("delivery/context", async () => {
        const now = new Date();
        const weekStart = getWeekStart(now);
        const endOfWeek = new Date(weekStart);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const [
          projects,
          handoffProjects,
          riskFlags,
          nbaActions,
        ] = await Promise.all([
          db.deliveryProject.findMany({
            where: { status: { notIn: ["archived"] } },
            select: {
              id: true,
              status: true,
              dueDate: true,
              completedAt: true,
              proofRequestedAt: true,
              proofCandidateId: true,
            },
          }),
          db.deliveryProject.findMany({
            where: { status: { in: ["completed", "archived"] } },
            select: {
              id: true,
              completedAt: true,
              handoffStartedAt: true,
              handoffCompletedAt: true,
              clientConfirmedAt: true,
            },
          }),
          db.riskFlag.findMany({
            where: {
              status: RiskStatus.open,
              createdByRule: { in: DELIVERY_RISK_RULES },
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
              createdByRule: { in: DELIVERY_NBA_RULES },
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

        let inProgress = 0;
        let dueSoon = 0;
        let overdue = 0;
        let completedThisWeek = 0;
        let proofRequestedPending = 0;
        for (const p of projects) {
          const health = computeProjectHealth({ status: p.status, dueDate: p.dueDate });
          if (["kickoff", "in_progress", "qa"].includes(p.status)) inProgress++;
          if (health === "due_soon") dueSoon++;
          if (health === "overdue") overdue++;
          if (p.status === "completed" && p.completedAt && p.completedAt >= weekStart && p.completedAt <= endOfWeek) {
            completedThisWeek++;
          }
          if (p.proofRequestedAt && !p.proofCandidateId) proofRequestedPending++;
        }

        let completedNoHandoff = 0;
        let handoffInProgress = 0;
        let handoffMissingClientConfirm = 0;
        for (const p of handoffProjects) {
          const hasStarted = !!p.handoffStartedAt;
          const hasCompleted = !!p.handoffCompletedAt;
          const hasClientConfirm = !!p.clientConfirmedAt;
          if (!hasStarted && !hasCompleted) completedNoHandoff++;
          else if (hasStarted && !hasCompleted) handoffInProgress++;
          else if (hasCompleted && !hasClientConfirm) handoffMissingClientConfirm++;
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
            inProgress,
            dueSoon,
            overdue,
            completedThisWeek,
            proofRequestedPending,
          },
          handoffSummary: {
            completedNoHandoff,
            handoffInProgress,
            handoffMissingClientConfirm,
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
      console.error("[delivery/context]", err);
      return jsonError(sanitizeErrorMessage(err), 500);
    }
  });
}
