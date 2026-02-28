/**
 * Phase 4.0: Fetch context for NBA rule evaluation.
 * Phase 6.3: Growth context when ownerUserId provided.
 */

import { db } from "@/lib/db";
import { getStartOfDay } from "@/lib/followup/dates";

const HOURS_24 = 24;

export async function fetchNextActionContext(opts?: { now?: Date; ownerUserId?: string }): Promise<{
  now: Date;
  commandCenterBand: string | null;
  failedDeliveryCount: number;
  overdueRemindersCount: number;
  sentNoFollowupDateCount: number;
  retentionOverdueCount: number;
  handoffNoClientConfirmCount: number;
  wonNoDeliveryCount: number;
  referralGapCount: number;
  stageStallCount: number;
  /** Phase 6.3: Growth pipeline (when ownerUserId provided) */
  growthOverdueCount?: number;
  growthNoOutreachCount?: number;
  growthDealCount?: number;
  growthLastActivityAt?: Date | null;
  growthFirstOverdueDealId?: string | null;
  growthFirstNoOutreachDealId?: string | null;
}> {
  const now = opts?.now ?? new Date();
  const ownerUserId = opts?.ownerUserId;
  const since24h = new Date(now.getTime() - HOURS_24 * 60 * 60 * 1000);
  const startToday = getStartOfDay(now);
  const msPerDay = 86400000;
  const threeDaysAgo = new Date(now.getTime() - 3 * msPerDay);
  const sevenDaysAgo = new Date(now.getTime() - 7 * msPerDay);
  const tenDaysAgo = new Date(now.getTime() - 10 * msPerDay);

  const [
    latestScore,
    failedDeliveries,
    overdueReminders,
    sentNoFollowup,
    retentionOverdue,
    handoffNoConfirm,
    wonNoDelivery,
    referralGap,
    stageStall,
  ] = await Promise.all([
    db.scoreSnapshot.findFirst({
      where: { entityType: "command_center", entityId: "command_center" },
      orderBy: { computedAt: "desc" },
      select: { band: true },
    }),
    db.notificationDelivery.count({
      where: {
        status: "failed",
        createdAt: { gte: since24h },
      },
    }),
    db.opsReminder.count({
      where: {
        status: "open",
        priority: { in: ["high", "critical"] },
        dueAt: { lt: startToday, not: null },
      },
    }),
    db.proposal.count({
      where: {
        status: { in: ["sent", "viewed"] },
        nextFollowUpAt: null,
        acceptedAt: null,
        rejectedAt: null,
      },
    }),
    db.deliveryProject.count({
      where: {
        status: { in: ["completed", "archived"] },
        retentionNextFollowUpAt: { lt: startToday, not: null },
      },
    }),
    db.deliveryProject.count({
      where: {
        status: { in: ["completed", "archived"] },
        handoffCompletedAt: { not: null },
        clientConfirmedAt: null,
      },
    }),
    db.lead.count({
      where: {
        dealOutcome: "won",
        updatedAt: { lt: threeDaysAgo },
        project: null,
      },
    }),
    db.lead.count({
      where: {
        dealOutcome: "won",
        updatedAt: { lt: sevenDaysAgo },
        OR: [
          { referralAskStatus: null },
          { referralAskStatus: "none" },
        ],
      },
    }),
    db.lead.count({
      where: {
        dealOutcome: null,
        status: { notIn: ["REJECTED"] },
        salesStage: { not: null },
        lastContactAt: { lt: tenDaysAgo, not: null },
      },
    }),
  ]);

  let growthOverdueCount: number | undefined;
  let growthNoOutreachCount: number | undefined;
  let growthDealCount: number | undefined;
  let growthLastActivityAt: Date | null | undefined;
  let growthFirstOverdueDealId: string | null | undefined;
  let growthFirstNoOutreachDealId: string | null | undefined;
  if (ownerUserId) {
    const [
      overdueFromSchedule,
      overdueFromDeal,
      noOutreach,
      dealCount,
      lastOutreachEvt,
      lastMsg,
      lastEvent,
      firstOverdue,
      firstNoOutreach,
    ] = await Promise.all([
      db.followUpSchedule.count({
          where: {
            deal: { ownerUserId, stage: { notIn: ["won", "lost"] } },
            status: "active",
            nextFollowUpAt: { lt: startToday },
          },
        }),
        db.deal.count({
          where: {
            ownerUserId,
            stage: { notIn: ["won", "lost"] },
            followUpSchedules: { none: { status: "active" } },
            nextFollowUpAt: { lt: startToday, not: null },
          },
        }),
        db.deal.count({
          where: {
            ownerUserId,
            stage: "new",
            outreachEvents: { none: { type: "sent" } },
            outreachMessages: { none: { status: "sent" } },
          },
        }),
        db.deal.count({ where: { ownerUserId } }),
      db.outreachEvent.findFirst({
        where: { ownerUserId },
        orderBy: { occurredAt: "desc" },
        select: { occurredAt: true },
      }),
      db.outreachMessage.findFirst({
        where: { deal: { ownerUserId } },
        orderBy: { sentAt: "desc" },
        select: { sentAt: true },
      }),
      db.dealEvent.findFirst({
        where: { deal: { ownerUserId } },
        orderBy: { occurredAt: "desc" },
        select: { occurredAt: true },
      }),
      db.followUpSchedule.findFirst({
        where: {
          deal: { ownerUserId, stage: { notIn: ["won", "lost"] } },
          status: "active",
          nextFollowUpAt: { lt: startToday },
        },
        orderBy: { nextFollowUpAt: "asc" },
        select: { dealId: true },
      }),
      db.deal.findFirst({
        where: {
          ownerUserId,
          stage: "new",
          outreachEvents: { none: { type: "sent" } },
          outreachMessages: { none: { status: "sent" } },
        },
        select: { id: true },
      }),
    ]);
    growthOverdueCount = overdueFromSchedule + overdueFromDeal;
    growthNoOutreachCount = noOutreach;
    growthDealCount = dealCount;
    growthFirstOverdueDealId = firstOverdue?.dealId ?? null;
    growthFirstNoOutreachDealId = firstNoOutreach?.id ?? null;
    const evtTs = lastOutreachEvt?.occurredAt?.getTime();
    const msgTs = lastMsg?.sentAt?.getTime();
    const dealEvtTs = lastEvent?.occurredAt?.getTime();
    growthLastActivityAt =
      evtTs != null || msgTs != null || dealEvtTs != null
        ? new Date(Math.max(evtTs ?? 0, msgTs ?? 0, dealEvtTs ?? 0))
        : null;
  }

  return {
    now,
    commandCenterBand: latestScore?.band ?? null,
    failedDeliveryCount: failedDeliveries ?? 0,
    overdueRemindersCount: overdueReminders ?? 0,
    sentNoFollowupDateCount: sentNoFollowup ?? 0,
    retentionOverdueCount: retentionOverdue ?? 0,
    handoffNoClientConfirmCount: handoffNoConfirm ?? 0,
    wonNoDeliveryCount: wonNoDelivery ?? 0,
    referralGapCount: referralGap ?? 0,
    stageStallCount: stageStall ?? 0,
    ...(ownerUserId && {
      growthOverdueCount,
      growthNoOutreachCount,
      growthDealCount,
      growthLastActivityAt,
      growthFirstOverdueDealId,
      growthFirstNoOutreachDealId,
    }),
  };
}
