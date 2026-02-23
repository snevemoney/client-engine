/**
 * Follow-up discipline metrics: due/overdue, no-touch-in-7d, avg touches, leak flag.
 * Powers the Follow-up Discipline Command Center card.
 */

import { db } from "@/lib/db";
import type { FollowUpDisciplineMetrics } from "./types";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export async function getFollowUpDisciplineMetrics(): Promise<FollowUpDisciplineMetrics> {
  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const sevenDaysAgo = new Date(now.getTime() - SEVEN_DAYS_MS);
  const ninetyDaysAgo = new Date(now.getTime() - NINETY_DAYS_MS);

  const leads = await db.lead.findMany({
    where: {
      status: { notIn: ["REJECTED"] },
      dealOutcome: { not: "won" },
    },
    select: {
      id: true,
      title: true,
      status: true,
      nextContactAt: true,
      lastContactAt: true,
      dealOutcome: true,
      touchCount: true,
      proposalSentAt: true,
    },
  });

  const withNextDue = leads.filter((l) => l.nextContactAt != null);
  const followUpsDueToday = withNextDue.filter(
    (l) => l.nextContactAt && new Date(l.nextContactAt) <= todayEnd && new Date(l.nextContactAt) >= new Date(now.getFullYear(), now.getMonth(), now.getDate())
  ).length;
  const overdueCount = withNextDue.filter((l) => l.nextContactAt && new Date(l.nextContactAt) < now).length;

  const activeOpen = leads.filter(
    (l) =>
      l.status !== "REJECTED" &&
      l.dealOutcome !== "won" &&
      (l.status === "NEW" || l.status === "ENRICHED" || l.status === "SCORED" || l.proposalSentAt != null)
  );
  const noTouchIn7DaysCount = activeOpen.filter(
    (l) => !l.lastContactAt || new Date(l.lastContactAt).getTime() < sevenDaysAgo.getTime()
  ).length;

  const won90d = await db.lead.findMany({
    where: {
      dealOutcome: "won",
      updatedAt: { gte: ninetyDaysAgo },
    },
    select: { id: true, touchCount: true },
  });
  const avgTouchesBeforeClose =
    won90d.length > 0
      ? Math.round((won90d.reduce((s, l) => s + l.touchCount, 0) / won90d.length) * 10) / 10
      : null;

  const activeWithTouches = activeOpen.filter((l) => l.touchCount > 0);
  const avgTouchesOnActive =
    activeWithTouches.length > 0
      ? Math.round((activeWithTouches.reduce((s, l) => s + l.touchCount, 0) / activeWithTouches.length) * 10) / 10
      : null;

  const touched7PlusNotWonCount = activeOpen.filter((l) => l.touchCount >= 7).length;

  const overdueLeads = withNextDue
    .filter((l) => l.nextContactAt && new Date(l.nextContactAt) < now)
    .map((l) => ({
      id: l.id,
      title: l.title,
      company: null as string | null,
      daysOverdue: Math.floor((now.getTime() - new Date(l.nextContactAt!).getTime()) / (24 * 60 * 60 * 1000)),
    }))
    .sort((a, b) => a.daysOverdue - b.daysOverdue)
    .slice(0, 10);

  const status: "ok" | "leak" =
    overdueCount > 0 || (noTouchIn7DaysCount > 0 && activeOpen.length > 0) ? "leak" : "ok";

  return {
    at: now.toISOString(),
    followUpsDueToday,
    overdueCount,
    noTouchIn7DaysCount,
    avgTouchesBeforeClose,
    avgTouchesOnActive,
    touched7PlusNotWonCount,
    status,
    overdueLeads,
  };
}
