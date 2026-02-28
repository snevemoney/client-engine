/**
 * Phase 6.3.2: Growth golden regression scenarios.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { NextRequest } from "next/server";
import {
  seedDeal,
  seedFollowUpSchedule,
  seedOutreachEvent,
  snapshotDeal,
  cleanupGoldenGrowth,
} from "./test-utils/run-growth-golden";
import { produceNextActions } from "@/lib/next-actions/rules";
import { fetchNextActionContext } from "@/lib/next-actions/fetch-context";
import { upsertNextActions } from "@/lib/next-actions/service";
import { runDeliveryAction } from "@/lib/next-actions/delivery-actions";

const OWNER_USER_ID = "golden_growth_user";

vi.mock("@/lib/http/rate-limit", () => ({
  getRequestClientKey: () => "golden",
  rateLimitByKey: () => ({ ok: true, remaining: 10, resetAt: Date.now() + 60_000 }),
}));

vi.mock("@/lib/api-utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-utils")>("@/lib/api-utils");
  return {
    ...actual,
    requireAuth: vi.fn().mockResolvedValue({ user: { id: OWNER_USER_ID } }),
    withRouteTiming: (_: string, fn: () => Promise<unknown>) => fn(),
  };
});

describe("Growth golden regression", () => {
  beforeEach(async () => {
    await cleanupGoldenGrowth(OWNER_USER_ID);
  });

  it("golden_growth_draft_creates_draft", async () => {
    const { dealId } = await seedDeal(OWNER_USER_ID);

    const { POST } = await import("@/app/api/internal/growth/outreach/draft/route");
    const req = new NextRequest("http://x/api/internal/growth/outreach/draft", {
      method: "POST",
      body: JSON.stringify({ dealId, templateKey: "broken_link_fix", channel: "dm" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("draftId");
    expect(data).toHaveProperty("content");
    expect(data).toHaveProperty("placeholders");
    expect(data.placeholders).toContain("name");

    const draft = await db.outreachMessage.findFirst({ where: { dealId } });
    expect(draft?.status).toBe("draft");
  });

  it("golden_growth_send_creates_event_and_schedule", async () => {
    const { dealId } = await seedDeal(OWNER_USER_ID);

    const { POST } = await import("@/app/api/internal/growth/outreach/send/route");
    const req = new NextRequest("http://x/api/internal/growth/outreach/send", {
      method: "POST",
      body: JSON.stringify({
        dealId,
        templateKey: "broken_link_fix",
        content: "Hi Test — noticed a broken link.",
        channel: "dm",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("outreachEventId");
    expect(data).toHaveProperty("messageId");
    expect(data).toHaveProperty("nextFollowUpAt");

    const snap = await snapshotDeal(dealId);
    expect(snap.outreachEvents).toHaveLength(1);
    expect(snap.outreachEvents[0].type).toBe("sent");
    expect(snap.schedules).toHaveLength(1);
    expect(snap.deal.stage).toBe("contacted");
    expect(snap.deal.nextFollowUpAt).not.toBeNull();
  });

  it("golden_growth_schedule_followup_updates_schedule_and_deal", async () => {
    const { dealId } = await seedDeal(OWNER_USER_ID, { stage: "contacted" });
    const past = new Date(Date.now() - 86400000);
    await seedFollowUpSchedule(dealId, { nextFollowUpAt: past, cadenceDays: 3 });

    const next = new Date();
    next.setDate(next.getDate() + 3);

    const { POST } = await import("@/app/api/internal/growth/followups/schedule/route");
    const req = new NextRequest("http://x/api/internal/growth/followups/schedule", {
      method: "POST",
      body: JSON.stringify({ dealId, nextFollowUpAt: next.toISOString(), cadenceDays: 3 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("nextFollowUpAt");

    const snap = await snapshotDeal(dealId);
    expect(snap.schedules).toHaveLength(1);
    expect(new Date(snap.schedules[0].nextFollowUpAt).getTime()).toBeCloseTo(next.getTime(), -3);
    expect(snap.deal.nextFollowUpAt).not.toBeNull();
  });

  it("golden_growth_mark_replied_updates_stage_and_logs_reply", async () => {
    const { dealId } = await seedDeal(OWNER_USER_ID, { stage: "contacted" });

    const nba = await db.nextBestAction.create({
      data: {
        title: "Mark replied test",
        priority: "medium",
        score: 50,
        status: "queued",
        sourceType: "growth_pipeline",
        dedupeKey: "nba:golden_growth:mark_replied",
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

  it("golden_growth_overdue_followup_produces_growth_nba_and_execute_schedule_3d", async () => {
    const { dealId } = await seedDeal(OWNER_USER_ID, { stage: "contacted" });
    const past = new Date(Date.now() - 86400000 * 2);
    await seedFollowUpSchedule(dealId, { nextFollowUpAt: past, cadenceDays: 3 });

    const ctx = await fetchNextActionContext({ now: new Date(), ownerUserId: OWNER_USER_ID });
    const candidates = produceNextActions(ctx, "founder_growth");

    const overdueRule = candidates.find((c) => c.createdByRule === "growth_overdue_followups");
    expect(overdueRule).toBeDefined();
    expect(overdueRule?.payloadJson).toMatchObject({ bucket: "overdue" });

    const created = await upsertNextActions(candidates);
    // created or updated — dedupeKey may exist from previous test run
    expect(created.created + created.updated).toBeGreaterThanOrEqual(1);

    const nba = await db.nextBestAction.findUnique({
      where: { dedupeKey: "nba:growth_overdue_followups:founder_growth" },
    });
    expect(nba).toBeDefined();

    const dealIdFromPayload = (nba?.payloadJson as Record<string, unknown>)?.dealId as string | undefined;
    if (dealIdFromPayload) {
      const result = await runDeliveryAction({
        nextActionId: nba!.id,
        actionKey: "growth_schedule_followup_3d",
        actorUserId: OWNER_USER_ID,
      });
      expect(result.ok).toBe(true);

      const snap = await snapshotDeal(dealIdFromPayload);
      expect(snap.schedules).toHaveLength(1);
      const nextDate = snap.schedules[0].nextFollowUpAt;
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      expect(Math.abs(new Date(nextDate).getTime() - threeDaysFromNow.getTime())).toBeLessThan(60000);
    }
  });
});
