/**
 * Sales Leak Dashboard: full PBD-style view with stage metrics, conversion, leak detection per stage.
 * Answers: "Where is the leak right now?" with evidence.
 */

import { db } from "@/lib/db";
import { getSalesLeakReport } from "./salesLeak";

const PBD_STAGES = [
  "PROSPECTING",
  "APPROACH_CONTACT",
  "PRESENTATION",
  "FOLLOW_UP",
  "REFERRAL",
  "RELATIONSHIP_MAINTENANCE",
] as const;

/** Default benchmark conversion targets (placeholder; later editable in settings). */
const DEFAULT_STAGE_TARGETS: Record<string, number> = {
  PROSPECTING: 20, // % of in-stage that became new leads this week (or moved)
  APPROACH_CONTACT: 30,
  PRESENTATION: 25,
  FOLLOW_UP: 50, // follow-ups done / due
  REFERRAL: 10,
  RELATIONSHIP_MAINTENANCE: 15,
};

export type StageLeakRow = {
  stage: string;
  label: string;
  inStage: number;
  currentConversion: number; // 0-100 or count-based
  targetConversion: number;
  leak: boolean;
  evidence: string;
};

export type SalesLeakDashboardData = {
  at: string;
  weekStart: string;
  weekEnd: string;
  /** Stage counts (from existing report) */
  stageCounts: Record<string, { in: number; due?: number; done?: number }>;
  /** Per-stage leak detection with evidence */
  stageLeaks: StageLeakRow[];
  /** Worst leak summary */
  worstLeakStage: string;
  worstLeakReason: string;
  /** Aggregate metrics */
  metrics: {
    newLeadsWeekly: number;
    contactedLeads: number;
    replyRatePct: number | null; // placeholder if no reply tracking
    meetingsBookedRatePct: number | null; // placeholder
    proposalsSent: number;
    proposalCloseRatePct: number | null; // won / (won+lost)
    avgFollowUpCountBeforeClose: number | null;
    noResponseLeadsCount: number; // sent proposal, no outcome, >14d
    referralsRequested: number;
    referralsReceived: number;
    repeatWorkRatePct: number | null; // placeholder
    timeLeadToProposalMedianDays: number | null;
    timeProposalToCloseMedianDays: number | null;
  };
  /** Raw counts for display */
  raw: {
    prospectingCount: number;
    newContactsMade: number;
    firstContactsSent: number;
    presentationsCount: number;
    followUpsDue: number;
    followUpsDone: number;
    referralAsksMade: number;
    referralLeadsReceived: number;
    relationshipTouches: number;
  };
};

export async function getSalesLeakDashboard(): Promise<SalesLeakDashboardData> {
  const report = await getSalesLeakReport();
  const now = new Date();

  // Proposal close rate: won / (won+lost) in last 90d
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const [won90, lost90, sent90] = await Promise.all([
    db.lead.count({ where: { dealOutcome: "won", updatedAt: { gte: ninetyDaysAgo } } }),
    db.lead.count({ where: { dealOutcome: "lost", updatedAt: { gte: ninetyDaysAgo } } }),
    db.lead.count({ where: { proposalSentAt: { not: null }, updatedAt: { gte: ninetyDaysAgo } } }),
  ]);
  const proposalCloseRatePct = won90 + lost90 > 0 ? Math.round((won90 / (won90 + lost90)) * 100) : null;

  // Avg follow-up count before close (won deals)
  const wonLeads = await db.lead.findMany({
    where: { dealOutcome: "won", updatedAt: { gte: ninetyDaysAgo } },
    select: { followUpCount: true, touchCount: true },
  });
  const avgFollowUpCountBeforeClose =
    wonLeads.length > 0
      ? Math.round((wonLeads.reduce((s, l) => s + (l.touchCount ?? l.followUpCount ?? 0), 0) / wonLeads.length) * 10) / 10
      : null;

  // No-response: proposal sent, no outcome, >14d
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const noResponseLeadsCount = await db.lead.count({
    where: {
      proposalSentAt: { not: null, lt: fourteenDaysAgo },
      dealOutcome: null,
      status: { not: "REJECTED" },
    },
  });

  // Time lead → proposal (median days) and proposal → close
  const leadsWithSent = await db.lead.findMany({
    where: { proposalSentAt: { not: null }, createdAt: { gte: ninetyDaysAgo } },
    select: { createdAt: true, proposalSentAt: true, updatedAt: true, dealOutcome: true },
  });
  const leadToProposalDays = leadsWithSent
    .map((l) => (l.proposalSentAt ? (new Date(l.proposalSentAt).getTime() - new Date(l.createdAt).getTime()) / (24 * 60 * 60 * 1000) : null))
    .filter((d): d is number => d != null);
  const proposalToCloseDays = leadsWithSent
    .filter((l) => l.dealOutcome === "won" || l.dealOutcome === "lost")
    .map((l) => (l.updatedAt ? (new Date(l.updatedAt).getTime() - new Date(l.proposalSentAt!).getTime()) / (24 * 60 * 60 * 1000) : null))
    .filter((d): d is number => d != null);
  const median = (arr: number[]) => {
    if (arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  };

  // Build stage leak rows with evidence
  const stageLeaks: StageLeakRow[] = [];
  const stageLabels: Record<string, string> = {
    PROSPECTING: "Prospecting",
    APPROACH_CONTACT: "Approach / Contact",
    PRESENTATION: "Presentation",
    FOLLOW_UP: "Follow-up",
    REFERRAL: "Referral",
    RELATIONSHIP_MAINTENANCE: "Relationship maintenance",
  };
  const inProspecting = report.stageCounts.PROSPECTING?.in ?? 0;
  const inFollowUp = report.stageCounts.FOLLOW_UP?.in ?? 0;
  const followUpsDue = report.followUpsDue ?? 0;
  const followUpsDone = report.followUpsDone ?? 0;
  const followUpPct = followUpsDue > 0 ? Math.round((followUpsDone / followUpsDue) * 100) : 0;
  const targetFollowUp = DEFAULT_STAGE_TARGETS.FOLLOW_UP ?? 50;
  stageLeaks.push({
    stage: "FOLLOW_UP",
    label: stageLabels.FOLLOW_UP,
    inStage: inFollowUp,
    currentConversion: followUpPct,
    targetConversion: targetFollowUp,
    leak: followUpsDue > 0 && followUpPct < targetFollowUp,
    evidence: followUpsDue > 0 ? `${followUpsDue} due, ${followUpsDone} done (${followUpPct}%)` : `${inFollowUp} in stage`,
  });
  if (inProspecting > 0 && report.prospectingCount === 0) {
    stageLeaks.push({
      stage: "PROSPECTING",
      label: stageLabels.PROSPECTING,
      inStage: inProspecting,
      currentConversion: 0,
      targetConversion: DEFAULT_STAGE_TARGETS.PROSPECTING ?? 20,
      leak: true,
      evidence: `${inProspecting} in stage, 0 new leads this week`,
    });
  }
  // Stuck at follow-up >14d (evidence)
  const stuckFollowUp14d = await db.lead.count({
    where: {
      status: { not: "REJECTED" },
      proposalSentAt: { not: null },
      dealOutcome: null,
      lastContactAt: { lt: fourteenDaysAgo },
    },
  });
  if (stuckFollowUp14d > 0) {
    const existing = stageLeaks.find((s) => s.stage === "FOLLOW_UP");
    if (existing) {
      existing.evidence += `; ${stuckFollowUp14d} leads stalled >14d no touch`;
    }
  }

  return {
    at: report.at,
    weekStart: report.weekStart,
    weekEnd: report.weekEnd,
    stageCounts: report.stageCounts,
    stageLeaks,
    worstLeakStage: report.worstLeakStage,
    worstLeakReason: report.worstLeakReason,
    metrics: {
      newLeadsWeekly: report.prospectingCount,
      contactedLeads: report.newContactsMade,
      replyRatePct: null, // would need reply tracking
      meetingsBookedRatePct: null,
      proposalsSent: sent90,
      proposalCloseRatePct: proposalCloseRatePct,
      avgFollowUpCountBeforeClose: avgFollowUpCountBeforeClose,
      noResponseLeadsCount: noResponseLeadsCount,
      referralsRequested: report.referralAsksMade,
      referralsReceived: report.referralLeadsReceived,
      repeatWorkRatePct: null,
      timeLeadToProposalMedianDays: median(leadToProposalDays),
      timeProposalToCloseMedianDays: median(proposalToCloseDays),
    },
    raw: {
      prospectingCount: report.prospectingCount,
      newContactsMade: report.newContactsMade,
      firstContactsSent: report.firstContactsSent,
      presentationsCount: report.presentationsCount,
      followUpsDue: report.followUpsDue,
      followUpsDone: report.followUpsDone,
      referralAsksMade: report.referralAsksMade,
      referralLeadsReceived: report.referralLeadsReceived,
      relationshipTouches: report.relationshipTouches,
    },
  };
}
