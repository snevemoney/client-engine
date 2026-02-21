/**
 * Follow-up discipline score: % on time, % with next date set, % with notes.
 */

import { db } from "@/lib/db";
import type { FollowUpDisciplineScore } from "./types";

const ACTIVE_STAGES = ["APPROACH_CONTACT", "PRESENTATION", "FOLLOW_UP"] as const;

function effectiveStage(lead: {
  salesStage: string | null;
  status: string;
  proposalSentAt: Date | null;
  dealOutcome: string | null;
}): string {
  if (lead.salesStage) return lead.salesStage;
  if (lead.dealOutcome === "won" || lead.dealOutcome === "lost") return "";
  if (lead.proposalSentAt) return "FOLLOW_UP";
  if (lead.status === "NEW" || lead.status === "ENRICHED" || lead.status === "SCORED") return "PROSPECTING";
  return "APPROACH_CONTACT";
}

export async function getFollowUpDisciplineScore(): Promise<FollowUpDisciplineScore> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const leads = await db.lead.findMany({
    where: { status: { not: "REJECTED" } },
    select: {
      id: true,
      status: true,
      salesStage: true,
      proposalSentAt: true,
      dealOutcome: true,
      nextContactAt: true,
      lastContactAt: true,
      personalDetails: true,
      updatedAt: true,
    },
  });

  const active = leads.filter((l) => ACTIVE_STAGES.includes(effectiveStage(l) as (typeof ACTIVE_STAGES)[number]));
  const withNextDate = active.filter((l) => l.nextContactAt != null);
  const activeLeadsWithoutNextDate = active.length - withNextDate.length;

  const dueInPast = withNextDate.filter((l) => l.nextContactAt && l.nextContactAt < now);
  const completedOnTime = dueInPast.filter(
    (l) => l.lastContactAt && l.nextContactAt && l.lastContactAt >= l.nextContactAt
  );
  const dueCount = dueInPast.length;
  const completedOnTimeCount = completedOnTime.length;
  const pctOnTime = dueCount > 0 ? Math.round((completedOnTimeCount / dueCount) * 100) : null;
  const pctWithNextDate = active.length > 0 ? Math.round((withNextDate.length / active.length) * 100) : 100;

  const withNotes = active.filter(
    (l) =>
      (l.personalDetails && l.personalDetails.trim().length > 0) ||
      (l.updatedAt && l.updatedAt >= sevenDaysAgo)
  );
  const pctWithNotes = active.length > 0 ? Math.round((withNotes.length / active.length) * 100) : 100;

  const components = [pctWithNextDate, pctWithNotes];
  if (pctOnTime !== null) components.push(pctOnTime);
  const compositeScore = Math.round(components.reduce((a, b) => a + b, 0) / components.length);

  return {
    at: now.toISOString(),
    pctOnTime,
    pctWithNextDate,
    pctWithNotes,
    compositeScore: Math.min(100, Math.max(0, compositeScore)),
    dueCount,
    completedOnTimeCount,
    activeLeadsWithoutNextDate,
  };
}
