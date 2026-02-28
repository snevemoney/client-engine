/**
 * Phase 6.3: Growth pipeline summary computation.
 * Phase 6.3.1: OutreachEvent + FollowUpSchedule as source of truth.
 */
import { db } from "@/lib/db";
import { DealStage } from "@prisma/client";

export type GrowthSummary = {
  countsByStage: Record<string, number>;
  overdueFollowUps: Array<{
    id: string;
    prospectName: string;
    stage: string;
    nextFollowUpAt: string;
  }>;
  next7DaysFollowUps: Array<{
    id: string;
    prospectName: string;
    stage: string;
    nextFollowUpAt: string;
  }>;
  lastActivityAt: string | null;
};

export async function computeGrowthSummary(ownerUserId: string): Promise<GrowthSummary> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(endOfWeek.getDate() + 8);

  const dealModel = db.deal;
  if (!dealModel?.groupBy) {
    return {
      countsByStage: {},
      overdueFollowUps: [],
      next7DaysFollowUps: [],
      lastActivityAt: null,
    };
  }

  const [byStage, overdueFromSchedule, next7DaysFromSchedule, dealsWithSchedule, lastOutreachEvent, lastLegacy] =
    await Promise.all([
      dealModel.groupBy({
        by: ["stage"],
        where: { ownerUserId },
        _count: { id: true },
      }),
      db.followUpSchedule.findMany({
        where: {
          deal: { ownerUserId, stage: { notIn: ["won", "lost"] } },
          status: "active",
          nextFollowUpAt: { lt: startOfToday },
        },
        include: { deal: { include: { prospect: { select: { name: true } } } } },
        orderBy: { nextFollowUpAt: "asc" },
        take: 10,
      }),
      db.followUpSchedule.findMany({
        where: {
          deal: { ownerUserId, stage: { notIn: ["won", "lost"] } },
          status: "active",
          nextFollowUpAt: { gte: startOfToday, lt: endOfWeek },
        },
        include: { deal: { include: { prospect: { select: { name: true } } } } },
        orderBy: { nextFollowUpAt: "asc" },
        take: 10,
      }),
      dealModel.findMany({
        where: {
          ownerUserId,
          stage: { notIn: ["won", "lost"] },
          followUpSchedules: { none: { status: "active" } },
          nextFollowUpAt: { lt: startOfToday, not: null },
        },
        include: { prospect: { select: { name: true } } },
        orderBy: { nextFollowUpAt: "asc" },
        take: 10,
      }),
      db.outreachEvent.findFirst({
        where: { ownerUserId },
        orderBy: { occurredAt: "desc" },
        select: { occurredAt: true },
      }),
      Promise.all([
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
      ]),
    ]);

  const overdue = [
    ...overdueFromSchedule.map((s) => ({
      id: s.deal.id,
      prospectName: s.deal.prospect.name,
      stage: s.deal.stage,
      nextFollowUpAt: s.nextFollowUpAt.toISOString(),
    })),
    ...dealsWithSchedule.map((d) => ({
      id: d.id,
      prospectName: d.prospect.name,
      stage: d.stage,
      nextFollowUpAt: d.nextFollowUpAt!.toISOString(),
    })),
  ].slice(0, 10);

  const next7Days = next7DaysFromSchedule.map((s) => ({
    id: s.deal.id,
    prospectName: s.deal.prospect.name,
    stage: s.deal.stage,
    nextFollowUpAt: s.nextFollowUpAt.toISOString(),
  }));

  const [lastMsg, lastDealEvt] = lastLegacy;
  const lastActivityAt = (() => {
    const evtTs = lastOutreachEvent?.occurredAt?.getTime();
    const msgTs = lastMsg?.sentAt?.getTime();
    const dealTs = lastDealEvt?.occurredAt?.getTime();
    const ts = Math.max(evtTs ?? 0, msgTs ?? 0, dealTs ?? 0);
    return ts > 0 ? new Date(ts).toISOString() : null;
  })();

  const countsByStage: Record<string, number> = {};
  for (const s of Object.values(DealStage)) {
    countsByStage[s] = 0;
  }
  for (const g of byStage) {
    countsByStage[g.stage] = g._count.id;
  }

  return {
    countsByStage,
    overdueFollowUps: overdue,
    next7DaysFollowUps: next7Days,
    lastActivityAt,
  };
}
