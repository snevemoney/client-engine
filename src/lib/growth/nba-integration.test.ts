/**
 * Phase 6.3.2: Growth NBA integration tests — founder_growth scope.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { fetchNextActionContext } from "@/lib/next-actions/fetch-context";
import { produceNextActions } from "@/lib/next-actions/rules";
import { upsertNextActions } from "@/lib/next-actions/service";
import { runDeliveryAction } from "@/lib/next-actions/delivery-actions";
import {
  seedDeal,
  seedFollowUpSchedule,
  seedOutreachEvent,
  cleanupGoldenGrowth,
  snapshotDeal,
} from "./test-utils/run-growth-golden";

const OWNER_USER_ID = "nba_growth_user";

describe("Growth NBA integration (founder_growth scope)", () => {
  beforeEach(async () => {
    await cleanupGoldenGrowth(OWNER_USER_ID);
  });

  it("overdue schedule exists → growth_overdue_followups emits", async () => {
    const { dealId } = await seedDeal(OWNER_USER_ID, { stage: "contacted" });
    const past = new Date(Date.now() - 86400000 * 2);
    await seedFollowUpSchedule(dealId, { nextFollowUpAt: past, status: "active" });

    const ctx = await fetchNextActionContext({ now: new Date(), ownerUserId: OWNER_USER_ID });
    const candidates = produceNextActions(ctx, "founder_growth");

    const overdue = candidates.filter((c) => c.createdByRule === "growth_overdue_followups");
    expect(overdue.length).toBeGreaterThanOrEqual(1);
    expect(overdue[0].payloadJson).toMatchObject({ bucket: "overdue" });
  });

  it("no outreach exists → growth_no_outreach_sent emits", async () => {
    await seedDeal(OWNER_USER_ID, { stage: "new" });

    const ctx = await fetchNextActionContext({ now: new Date(), ownerUserId: OWNER_USER_ID });
    const candidates = produceNextActions(ctx, "founder_growth");

    const noOutreach = candidates.filter((c) => c.createdByRule === "growth_no_outreach_sent");
    expect(noOutreach.length).toBeGreaterThanOrEqual(1);
  });

  it("growth_schedule_followup_3d uses payloadJson.dealId and creates schedule", async () => {
    const { dealId } = await seedDeal(OWNER_USER_ID);
    const dedupeKey = `nba:growth_integration:schedule:${Date.now()}:${Math.random().toString(36).slice(2)}`;

    const nba = await db.nextBestAction.create({
      data: {
        title: "Schedule test",
        priority: "medium",
        score: 50,
        status: "queued",
        sourceType: "growth_pipeline",
        dedupeKey,
        createdByRule: "growth_overdue_followups",
        entityType: "founder_growth",
        entityId: "founder_growth",
        payloadJson: { dealId },
      },
    });

    const result = await runDeliveryAction({
      nextActionId: nba.id,
      actionKey: "growth_schedule_followup_3d",
      actorUserId: OWNER_USER_ID,
    });

    expect(result.ok).toBe(true);

    const snap = await snapshotDeal(dealId);
    expect(snap.schedules).toHaveLength(1);
    expect(snap.deal.nextFollowUpAt).not.toBeNull();
  });

  it("growth_mark_replied logs OutreachEvent.reply and sets stage", async () => {
    const { dealId } = await seedDeal(OWNER_USER_ID, { stage: "contacted" });
    const dedupeKey = `nba:growth_integration:replied:${Date.now()}:${Math.random().toString(36).slice(2)}`;

    const nba = await db.nextBestAction.create({
      data: {
        title: "Mark replied test",
        priority: "medium",
        score: 50,
        status: "queued",
        sourceType: "growth_pipeline",
        dedupeKey,
        createdByRule: "growth_overdue_followups",
        entityType: "founder_growth",
        entityId: "founder_growth",
        payloadJson: { dealId },
      },
    });

    const result = await runDeliveryAction({
      nextActionId: nba.id,
      actionKey: "growth_mark_replied",
      actorUserId: OWNER_USER_ID,
    });

    expect(result.ok).toBe(true);

    const snap = await snapshotDeal(dealId);
    expect(snap.deal.stage).toBe("replied");
    expect(snap.outreachEvents.some((e) => e.type === "reply")).toBe(true);
  });
});
