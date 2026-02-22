/**
 * Ops Health: single aggregate for "is the system healthy?"
 * Used by the Ops Health panel (one clear operational view).
 * Layer A (revenue-critical) awareness; does not change any workflows.
 */

import { db } from "@/lib/db";
import { getFailuresAndInterventions } from "./failuresInterventions";

const STALE_NO_ACTIVITY_DAYS = 7;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type WorkdayRunStatus = "success" | "partial" | "fail" | "none";

export type OpsHealth = {
  /** Last workday run: status and timestamp */
  workdayRun: {
    status: WorkdayRunStatus;
    lastRunAt: string | null;
    lastSuccessAt: string | null;
    warningNoSuccessIn24h: boolean;
  };
  /** Failed pipeline runs in last 24h and 7d */
  failedJobs: {
    last24h: number;
    last7d: number;
  };
  /** Leads with no touch/activity in > STALE_NO_ACTIVITY_DAYS days */
  staleLeadsCount: number;
  /** Proposals drafted but not sent, sitting > threshold days */
  stuckProposalsCount: number;
  /** Items waiting on human: send proposal, start build */
  approvalQueueCount: number;
  /** Integration health (stub: DB, last research run, last knowledge run) */
  integrationHealth: {
    db: boolean;
    research: { ok: boolean; lastRunAt: string | null; message: string };
    knowledge: { ok: boolean; lastRunAt: string | null; message: string };
    auth: boolean;
  };
  /** Aggregated failures & interventions (what failed, blocked, needs intervention, recommended action) */
  failuresAndInterventions: {
    failed: Array<{ leadId: string; leadTitle: string; runId: string; lastErrorCode: string | null; lastErrorAt: string | null }>;
    blocked: Array<{ leadId: string; leadTitle: string; kind: "stale" | "stuck_proposal"; days: number }>;
    needsIntervention: Array<{ leadId: string; leadTitle: string; action: string }>;
    totalCount: number;
    recommendedNextAction: string;
  };
};

function inferWorkdayStatus(meta: unknown): { status: WorkdayRunStatus; ok: boolean } {
  if (meta == null || typeof meta !== "object") return { status: "none", ok: false };
  const m = meta as Record<string, unknown>;
  const research = m.research as { errors?: string[] } | undefined;
  const pipeline = m.pipeline as { errors?: string[] } | undefined;
  const knowledge = m.knowledge as { errors?: string[] } | undefined;
  const errCount = (research?.errors?.length ?? 0) + (pipeline?.errors?.length ?? 0) + (knowledge?.errors?.length ?? 0);
  if (errCount === 0) return { status: "success", ok: true };
  if (errCount < 3) return { status: "partial", ok: false };
  return { status: "fail", ok: false };
}

export async function getOpsHealth(): Promise<OpsHealth> {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - DAY_MS);
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);
  const staleCutoff = new Date(now.getTime() - STALE_NO_ACTIVITY_DAYS * DAY_MS);

  // Last workday run(s): find last report and last successful
  const systemLead = await db.lead.findFirst({
    where: { source: "system", title: "Research Engine Runs" },
    select: { id: true },
  });
  const workdayReports = systemLead
    ? await db.artifact.findMany({
        where: { leadId: systemLead.id, title: "WORKDAY_RUN_REPORT" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { createdAt: true, meta: true },
      })
    : [];
  let lastRunAt: string | null = null;
  let lastSuccessAt: string | null = null;
  let lastStatus: WorkdayRunStatus = "none";
  for (const r of workdayReports) {
    if (!lastRunAt) lastRunAt = r.createdAt.toISOString();
    const { status, ok } = inferWorkdayStatus(r.meta);
    if (lastStatus === "none") lastStatus = status;
    if (ok && !lastSuccessAt) lastSuccessAt = r.createdAt.toISOString();
  }
  const warningNoSuccessIn24h =
    lastSuccessAt !== null ? new Date(lastSuccessAt).getTime() < now.getTime() - DAY_MS : lastRunAt !== null;

  // Failed jobs 24h / 7d
  const [failed24h, failed7d] = await Promise.all([
    db.pipelineRun.count({ where: { success: false, lastErrorAt: { gte: dayAgo } } }),
    db.pipelineRun.count({ where: { success: false, lastErrorAt: { gte: sevenDaysAgo } } }),
  ]);

  // Stale leads: no lastContactAt or lastContactAt < staleCutoff; exclude REJECTED
  const staleLeadsCount = await db.lead.count({
    where: {
      status: { not: "REJECTED" },
      OR: [{ lastContactAt: null }, { lastContactAt: { lt: staleCutoff } }],
      // Had some engagement (created more than X days ago so we're not counting brand-new leads)
      createdAt: { lt: staleCutoff },
    },
  });

  // Stuck proposals: has proposal artifact, not sent, proposal created > 5 days ago
  const stuckCutoff = new Date(now.getTime() - 5 * DAY_MS);
  const leadsWithProposal = await db.lead.findMany({
    where: {
      status: { not: "REJECTED" },
      proposalSentAt: null,
      artifacts: { some: { type: "proposal" } },
    },
    select: {
      id: true,
      artifacts: {
        where: { type: "proposal" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });
  const stuckProposalsCount = leadsWithProposal.filter((l) => {
    const created = l.artifacts[0]?.createdAt;
    return created && new Date(created) < stuckCutoff;
  }).length;

  // Approval queue: ready to send proposal + approved not building
  const [readyProposals, approvedNotBuilding] = await Promise.all([
    db.lead.count({
      where: {
        status: { not: "REJECTED" },
        proposalSentAt: null,
        artifacts: { some: { type: "proposal" } },
      },
    }),
    db.lead.count({
      where: {
        status: "APPROVED",
        buildStartedAt: null,
        project: null,
      },
    }),
  ]);
  const approvalQueueCount = Math.min(readyProposals, 10) + approvedNotBuilding; // cap "ready" to avoid huge number

  // Integration health: DB (from health check), research = last workday, knowledge = from workday or queue
  let dbOk = false;
  try {
    await db.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    // leave false
  }
  const authOk = !!(process.env.AUTH_SECRET && process.env.NEXTAUTH_URL);
  const lastReport = workdayReports[0];
  const researchLastRun = lastReport?.createdAt.toISOString() ?? null;
  const researchMeta = lastReport?.meta as { research?: { errors?: string[] }; pipeline?: { errors?: string[] } } | undefined;
  const researchOk = !researchMeta?.research?.errors?.length && !researchMeta?.pipeline?.errors?.length;
  // Knowledge: assume same workday report includes knowledge; if no report, "unknown"
  const knowledgeLastRun = researchLastRun;
  const knowledgeOk = !(lastReport?.meta as { knowledge?: { errors?: string[] } })?.knowledge?.errors?.length;

  // Failures & interventions (reuse existing)
  const fi = await getFailuresAndInterventions();
  const failed = fi.failedPipelineRuns.map((r) => ({
    leadId: r.leadId,
    leadTitle: r.leadTitle,
    runId: r.runId,
    lastErrorCode: r.lastErrorCode,
    lastErrorAt: r.lastErrorAt,
  }));
  const blocked = [
    ...fi.staleLeads.map((l) => ({ leadId: l.leadId, leadTitle: l.leadTitle, kind: "stale" as const, days: l.daysSinceSent })),
    ...fi.stuckProposals.map((l) => ({ leadId: l.leadId, leadTitle: l.leadTitle, kind: "stuck_proposal" as const, days: l.daysStuck })),
  ];
  const needsIntervention = fi.needsApproval;
  let recommendedNextAction = "No urgent action.";
  if (fi.needsApproval.length > 0) {
    recommendedNextAction = `Review ${fi.needsApproval.length} item(s) waiting on your approval (send proposal or start build).`;
  } else if (fi.failedPipelineRuns.length > 0) {
    recommendedNextAction = "Retry failed pipeline runs from lead detail or metrics.";
  } else if (fi.stuckProposals.length > 0 || fi.staleLeads.length > 0) {
    recommendedNextAction = "Follow up on stuck proposals or stale leads.";
  }

  return {
    workdayRun: {
      status: lastStatus,
      lastRunAt,
      lastSuccessAt,
      warningNoSuccessIn24h: !!warningNoSuccessIn24h,
    },
    failedJobs: { last24h: failed24h, last7d: failed7d },
    staleLeadsCount,
    stuckProposalsCount,
    approvalQueueCount,
    integrationHealth: {
      db: dbOk,
      research: {
        ok: researchOk,
        lastRunAt: researchLastRun,
        message: researchLastRun
          ? `Last run ${new Date(researchLastRun).toLocaleString()}`
          : "No workday run yet.",
      },
      knowledge: {
        ok: knowledgeOk,
        lastRunAt: knowledgeLastRun,
        message: knowledgeLastRun
          ? `Last run ${new Date(knowledgeLastRun).toLocaleString()}`
          : "No workday run yet.",
      },
      auth: authOk,
    },
    failuresAndInterventions: {
      failed,
      blocked,
      needsIntervention,
      totalCount: fi.totalCount,
      recommendedNextAction,
    },
  };
}
