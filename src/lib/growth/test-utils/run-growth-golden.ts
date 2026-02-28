/**
 * Phase 6.3.2: Growth golden scenario helpers — seed and execute.
 */
import { db } from "@/lib/db";
import { ProspectPlatform } from "@prisma/client";

const GOLDEN_SCOPE = "golden_growth";

export type SeedDealOverrides = {
  stage?: "new" | "contacted" | "replied" | "call_scheduled" | "proposal_sent" | "won" | "lost";
  nextFollowUpAt?: Date | null;
};

export async function seedDeal(
  ownerUserId: string,
  overrides?: SeedDealOverrides
): Promise<{ prospectId: string; dealId: string }> {
  const prospect = await db.prospect.create({
    data: {
      name: `Golden Prospect ${GOLDEN_SCOPE} ${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      handle: `golden_${GOLDEN_SCOPE}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      platform: ProspectPlatform.instagram,
      niche: "creators",
      followers: 5000,
    },
  });

  const deal = await db.deal.create({
    data: {
      prospectId: prospect.id,
      ownerUserId,
      stage: overrides?.stage ?? "new",
      nextFollowUpAt: overrides?.nextFollowUpAt ?? null,
    },
  });

  return { prospectId: prospect.id, dealId: deal.id };
}

export type SeedFollowUpScheduleOverrides = {
  nextFollowUpAt?: Date;
  cadenceDays?: number;
  status?: "active" | "paused" | "completed";
};

export async function seedFollowUpSchedule(
  dealId: string,
  overrides?: SeedFollowUpScheduleOverrides
) {
  const next = overrides?.nextFollowUpAt ?? new Date();
  return db.followUpSchedule.create({
    data: {
      dealId,
      nextFollowUpAt: next,
      cadenceDays: overrides?.cadenceDays ?? 3,
      status: (overrides?.status ?? "active") as "active" | "paused" | "completed",
    },
  });
}

export async function seedOutreachEvent(
  dealId: string,
  ownerUserId: string,
  type: "sent" | "reply" | "bounced" | "call_booked" | "followup_scheduled",
  occurredAt: Date
) {
  return db.outreachEvent.create({
    data: {
      dealId,
      ownerUserId,
      channel: "dm",
      type,
      occurredAt,
      metaJson: { source: GOLDEN_SCOPE },
    },
  });
}

export type GrowthGoldenSnapshot = {
  deal: { id: string; stage: string; nextFollowUpAt: Date | null };
  schedules: Array<{ id: string; nextFollowUpAt: Date; status: string }>;
  outreachEvents: Array<{ id: string; type: string; occurredAt: Date }>;
};

export async function snapshotDeal(dealId: string): Promise<GrowthGoldenSnapshot> {
  const deal = await db.deal.findUnique({
    where: { id: dealId },
    include: {
      followUpSchedules: true,
      outreachEvents: { orderBy: { occurredAt: "desc" } },
    },
  });
  if (!deal) throw new Error(`Deal ${dealId} not found`);

  return {
    deal: {
      id: deal.id,
      stage: deal.stage,
      nextFollowUpAt: deal.nextFollowUpAt,
    },
    schedules: deal.followUpSchedules.map((s) => ({
      id: s.id,
      nextFollowUpAt: s.nextFollowUpAt,
      status: s.status,
    })),
    outreachEvents: deal.outreachEvents.map((e) => ({
      id: e.id,
      type: e.type,
      occurredAt: e.occurredAt,
    })),
  };
}

export async function cleanupGoldenGrowth(ownerUserId: string): Promise<void> {
  const deals = await db.deal.findMany({
    where: {
      ownerUserId,
      prospect: { handle: { contains: GOLDEN_SCOPE } },
    },
    select: { id: true, prospectId: true },
  });
  const prospectIds = [...new Set(deals.map((d) => d.prospectId))];
  for (const d of deals) {
    await db.followUpSchedule.deleteMany({ where: { dealId: d.id } });
    await db.outreachEvent.deleteMany({ where: { dealId: d.id } });
    await db.outreachMessage.deleteMany({ where: { dealId: d.id } });
    await db.dealEvent.deleteMany({ where: { dealId: d.id } });
    await db.deal.delete({ where: { id: d.id } });
  }
  for (const pid of prospectIds) {
    await db.prospect.delete({ where: { id: pid } }).catch(() => {});
  }
  await db.nextBestAction.deleteMany({
    where: {
      OR: [
        { dedupeKey: { contains: "golden_growth" } },
        { dedupeKey: { endsWith: ":founder_growth" } },
      ],
    },
  });
}
