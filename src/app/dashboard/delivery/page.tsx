import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { DeliveryClient } from "./DeliveryClient";
import { normalizePagination } from "@/lib/ui/pagination-safe";
import { computeProjectHealth } from "@/lib/delivery/readiness";
import { RiskStatus, NextActionStatus } from "@prisma/client";
import { getWeekStart } from "@/lib/ops/weekStart";

export const dynamic = "force-dynamic";

const DELIVERY_NBA_RULES = ["handoff_no_client_confirm", "retention_overdue"];
const DELIVERY_RISK_RULES = ["retention_overdue"];

async function fetchDeliveryContext() {
  try {
    const now = new Date();
    const weekStart = getWeekStart(now);
    const endOfWeek = new Date(weekStart);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const [allProjects, riskFlags, nbaActions] = await Promise.all([
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
    for (const p of allProjects) {
      const health = computeProjectHealth({ status: p.status, dueDate: p.dueDate });
      if (["kickoff", "in_progress", "qa"].includes(p.status)) inProgress++;
      if (health === "due_soon") dueSoon++;
      if (health === "overdue") overdue++;
      if (
        p.status === "completed" &&
        p.completedAt &&
        p.completedAt >= weekStart &&
        p.completedAt <= endOfWeek
      ) {
        completedThisWeek++;
      }
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
      summary: { inProgress, dueSoon, overdue, completedThisWeek },
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
  } catch {
    return null;
  }
}

export default async function DeliveryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [projects, total, contextData] = await Promise.all([
    db.deliveryProject.findMany({
      where: { status: { not: "archived" } },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        status: true,
        title: true,
        clientName: true,
        company: true,
        dueDate: true,
        proofCandidateId: true,
        createdAt: true,
      },
    }),
    db.deliveryProject.count({ where: { status: { not: "archived" } } }),
    fetchDeliveryContext(),
  ]);

  const serialized = projects.map((p) => ({
    id: p.id,
    status: p.status,
    title: p.title,
    clientName: p.clientName,
    company: p.company,
    dueDate: p.dueDate?.toISOString() ?? null,
    health: computeProjectHealth({ status: p.status, dueDate: p.dueDate }),
    proofCandidateId: p.proofCandidateId,
    createdAt: p.createdAt.toISOString(),
  }));

  return (
    <DeliveryClient
      initialData={{
        projects: serialized,
        pagination: normalizePagination(
          { page: 1, pageSize: 25, total, totalPages: Math.ceil(total / 25) },
          serialized.length,
        ),
        summary: contextData?.summary ?? null,
        risk: contextData?.risk ?? null,
        nba: contextData?.nba ?? null,
      }}
    />
  );
}
