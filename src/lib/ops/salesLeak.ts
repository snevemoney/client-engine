/**
 * PBD sales leak: stage counts for the current week and worst leak detection.
 */

import { db } from "@/lib/db";
import type { SalesLeakReport } from "./types";

const PBD_STAGES = [
  "PROSPECTING",
  "APPROACH_CONTACT",
  "PRESENTATION",
  "FOLLOW_UP",
  "REFERRAL",
  "RELATIONSHIP_MAINTENANCE",
] as const;

function getWeekBounds(now: Date): { start: Date; end: Date } {
  const start = new Date(now);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function inRange(d: Date | null, start: Date, end: Date): boolean {
  if (!d) return false;
  const t = d.getTime();
  return t >= start.getTime() && t <= end.getTime();
}

/** Derive display sales stage when salesStage is null. */
function effectiveStage(lead: {
  salesStage: string | null;
  status: string;
  proposalSentAt: Date | null;
  dealOutcome: string | null;
}): string {
  if (lead.salesStage) return lead.salesStage;
  if (lead.dealOutcome === "won") return "REFERRAL";
  if (lead.dealOutcome === "lost") return "RELATIONSHIP_MAINTENANCE";
  if (lead.proposalSentAt) return "FOLLOW_UP";
  if (lead.status === "NEW" || lead.status === "ENRICHED" || lead.status === "SCORED") return "PROSPECTING";
  return "APPROACH_CONTACT";
}

export async function getSalesLeakReport(): Promise<SalesLeakReport> {
  const now = new Date();
  const { start: weekStart, end: weekEnd } = getWeekBounds(now);

  const leads = await db.lead.findMany({
    where: {
      status: { not: "REJECTED" },
    },
    take: 500,
    select: {
      id: true,
      status: true,
      salesStage: true,
      nextContactAt: true,
      lastContactAt: true,
      proposalSentAt: true,
      dealOutcome: true,
      leadSourceType: true,
      referralAskStatus: true,
      referralAskAt: true,
      relationshipLastCheck: true,
      createdAt: true,
    },
  });

  // Relationship maintenance: CHECK_IN touches this week + leads with relationshipLastCheck updated this week.
  const [checkInTouchesThisWeek, leadsWithRelationshipCheckThisWeek] = await Promise.all([
    db.leadTouch.count({
      where: {
        type: "CHECK_IN",
        createdAt: { gte: weekStart, lte: weekEnd },
      },
    }),
    db.lead.count({
      where: {
        relationshipLastCheck: { gte: weekStart, lte: weekEnd },
      },
    }),
  ]);
  const relationshipTouches = checkInTouchesThisWeek + leadsWithRelationshipCheckThisWeek;

  const stageCounts: Record<string, { in: number; due?: number; done?: number }> = {};
  for (const s of PBD_STAGES) {
    stageCounts[s] = { in: 0, due: 0, done: 0 };
  }

  let prospectingCount = 0;
  let newContactsMade = 0;
  let firstContactsSent = 0;
  let presentationsCount = 0;
  let followUpsDue = 0;
  let followUpsDone = 0;
  let referralAsksMade = 0;
  let referralLeadsReceived = 0;

  for (const lead of leads) {
    const stage = effectiveStage(lead);
    stageCounts[stage]!.in += 1;

    if (inRange(lead.createdAt, weekStart, weekEnd)) {
      prospectingCount += 1;
    }

    const lastInWeek = inRange(lead.lastContactAt, weekStart, weekEnd);
    const nextInWeek = lead.nextContactAt && lead.nextContactAt <= weekEnd && lead.nextContactAt >= weekStart;
    if (lastInWeek || (lead.nextContactAt && inRange(lead.nextContactAt, weekStart, weekEnd))) {
      newContactsMade += 1;
    }

    if (lead.proposalSentAt && inRange(lead.proposalSentAt, weekStart, weekEnd)) {
      firstContactsSent += 1;
    }

    if (lead.proposalSentAt) {
      if (inRange(lead.proposalSentAt, weekStart, weekEnd)) presentationsCount += 1;
      else if (stage === "FOLLOW_UP" || stage === "PRESENTATION") {
        presentationsCount += 1;
      }
    }

    if (stage === "FOLLOW_UP" || stage === "APPROACH_CONTACT") {
      if (lead.nextContactAt && lead.nextContactAt <= weekEnd) followUpsDue += 1;
    }

    if (lead.referralAskStatus === "asked" && lead.referralAskAt && inRange(lead.referralAskAt, weekStart, weekEnd)) {
      referralAsksMade += 1;
    }

    if (lead.leadSourceType === "network_referral" && inRange(lead.createdAt, weekStart, weekEnd)) {
      referralLeadsReceived += 1;
    }
  }

  followUpsDone = leads.filter(
    (l) =>
      (effectiveStage(l) === "FOLLOW_UP" || effectiveStage(l) === "APPROACH_CONTACT") &&
      l.nextContactAt &&
      l.nextContactAt <= weekEnd &&
      l.lastContactAt &&
      l.lastContactAt >= weekStart
  ).length;

  let worstLeakStage = "PROSPECTING";
  let worstLeakReason = "No activity this week";

  const dropOffs: { stage: string; due: number; done: number; reason: string }[] = [];
  if (followUpsDue > 0) {
    dropOffs.push({
      stage: "FOLLOW_UP",
      due: followUpsDue,
      done: followUpsDone,
      reason: `${followUpsDue} due, ${followUpsDone} done`,
    });
  }
  if (prospectingCount === 0 && stageCounts.PROSPECTING.in > 0) {
    dropOffs.push({
      stage: "PROSPECTING",
      due: stageCounts.PROSPECTING.in,
      done: 0,
      reason: `${stageCounts.PROSPECTING.in} in stage, 0 new this week`,
    });
  }

  if (dropOffs.length > 0) {
    const worst = dropOffs.reduce((a, b) => (b.due - b.done > (a.due - a.done) ? b : a));
    worstLeakStage = worst.stage;
    worstLeakReason = worst.reason;
  }

  return {
    at: now.toISOString(),
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    stageCounts,
    worstLeakStage,
    worstLeakReason,
    prospectingCount,
    newContactsMade,
    firstContactsSent,
    presentationsCount,
    followUpsDue,
    followUpsDone,
    referralAsksMade,
    referralLeadsReceived,
    relationshipTouches,
  };
}
