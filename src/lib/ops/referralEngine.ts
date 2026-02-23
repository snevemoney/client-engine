/**
 * Referral engine metrics: asks this week, received this month, conversion %, eligible count.
 * Powers the Referral Engine Command Center card.
 */

import { db } from "@/lib/db";
import type { ReferralEngineMetrics } from "./types";

function getWeekStart(d: Date): Date {
  const start = new Date(d);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function getMonthStart(d: Date): Date {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  return start;
}

export async function getReferralEngineMetrics(): Promise<ReferralEngineMetrics> {
  const now = new Date();
  const weekStart = getWeekStart(now);
  const monthStart = getMonthStart(now);

  const [leadsWithReferralAsk, referralsThisMonth, allReferrals, shippedNoAsk] = await Promise.all([
    db.lead.findMany({
      where: {
        referralAskStatus: "asked",
        referralAskAt: { gte: weekStart },
      },
      select: { id: true },
    }),
    db.leadReferral.findMany({
      where: { createdAt: { gte: monthStart } },
      select: { id: true, status: true, sourceLeadId: true },
    }),
    db.leadReferral.findMany({
      select: { id: true, status: true },
    }),
    db.lead.findMany({
      where: {
        status: "SHIPPED",
        dealOutcome: "won",
        referralAskStatus: { not: "asked" },
      },
      select: { id: true },
    }),
  ]);

  const referralAsksThisWeek = leadsWithReferralAsk.length;
  const referralsReceivedThisMonth = referralsThisMonth.length;

  const qualified = allReferrals.filter((r) => ["qualified", "proposal_sent", "won", "lost"].includes(r.status)).length;
  const won = allReferrals.filter((r) => r.status === "won").length;
  const referralToQualifiedPct =
    allReferrals.length > 0 ? Math.round((qualified / allReferrals.length) * 1000) / 10 : null;
  const referralToWonPct =
    allReferrals.length > 0 ? Math.round((won / allReferrals.length) * 1000) / 10 : null;

  const bySource = referralsThisMonth.reduce<Record<string, number>>((acc, r) => {
    acc[r.sourceLeadId] = (acc[r.sourceLeadId] ?? 0) + 1;
    return acc;
  }, {});
  const topReferralSourceCount = Object.values(bySource).length > 0 ? Math.max(...Object.values(bySource)) : 0;

  const eligibleForReferralAskCount = shippedNoAsk.length;

  return {
    at: now.toISOString(),
    referralAsksThisWeek: referralAsksThisWeek,
    referralsReceivedThisMonth,
    referralToQualifiedPct,
    referralToWonPct,
    topReferralSourceCount,
    eligibleForReferralAskCount,
  };
}
