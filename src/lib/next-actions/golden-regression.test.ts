/**
 * Phase 4.0.1.5: Next Actions golden regression scenarios.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { NextActionPriority, NextActionStatus, RiskSourceType } from "@prisma/client";
import { produceNextActions } from "./rules";
import { upsertNextActions, completeNextAction, dismissNextAction } from "./service";
import type { NextActionContext } from "./types";

const SCOPE = "golden_nba";

describe("Next Actions golden regression", () => {
  beforeEach(async () => {
    await db.nextBestAction.deleteMany({ where: { dedupeKey: { contains: SCOPE } } });
    await db.nextBestAction.deleteMany({ where: { dedupeKey: { contains: "score_in_critical_band" } } });
    await db.scoreSnapshot.deleteMany({ where: { entityId: "command_center" } });
  });

  it("golden_nba_creates_ranked_actions: context produces ranked actions by priority", async () => {
    const ctx: NextActionContext = {
      now: new Date(),
      commandCenterBand: "critical",
      failedDeliveryCount: 2,
      overdueRemindersCount: 1,
      sentNoFollowupDateCount: 0,
      retentionOverdueCount: 0,
      handoffNoClientConfirmCount: 0,
      wonNoDeliveryCount: 0,
      referralGapCount: 0,
      stageStallCount: 0,
    };
    const candidates = produceNextActions(ctx);
    expect(candidates.length).toBeGreaterThanOrEqual(2);
    expect(candidates[0].priority).toBe(NextActionPriority.critical);
    expect(candidates[0].score).toBeGreaterThanOrEqual(candidates[1]?.score ?? 0);
  });

  it("golden_nba_rerun_idempotent: repeated upsert does not duplicate", async () => {
    await db.scoreSnapshot.create({
      data: {
        entityType: "command_center",
        entityId: "command_center",
        score: 40,
        band: "critical",
        delta: -10,
        factorsJson: [],
        reasonsJson: [],
        computedAt: new Date(),
      },
    });
    const ctx: NextActionContext = {
      now: new Date(),
      commandCenterBand: "critical",
      failedDeliveryCount: 0,
      overdueRemindersCount: 0,
      sentNoFollowupDateCount: 0,
      retentionOverdueCount: 0,
      handoffNoClientConfirmCount: 0,
      wonNoDeliveryCount: 0,
      referralGapCount: 0,
      stageStallCount: 0,
    };
    const candidates = produceNextActions(ctx);
    const r1 = await upsertNextActions(candidates);
    const r2 = await upsertNextActions(candidates);
    expect(r1.created).toBeGreaterThanOrEqual(1);
    expect(r2.created).toBe(0);
  });

  it("golden_nba_dismiss_persists_on_rerun: dismissed stays dismissed", async () => {
    const action = await db.nextBestAction.create({
      data: {
        title: "Golden dismiss test",
        priority: NextActionPriority.medium,
        score: 55,
        status: NextActionStatus.queued,
        sourceType: RiskSourceType.proposal,
        dedupeKey: `nba:${SCOPE}:dismiss_test`,
        createdByRule: SCOPE,
      },
    });
    await dismissNextAction(action.id);
    const updated = await db.nextBestAction.findUnique({ where: { id: action.id } });
    expect(updated?.status).toBe(NextActionStatus.dismissed);

    const ctx: NextActionContext = {
      now: new Date(),
      commandCenterBand: null,
      failedDeliveryCount: 0,
      overdueRemindersCount: 0,
      sentNoFollowupDateCount: 0,
      retentionOverdueCount: 0,
      handoffNoClientConfirmCount: 0,
      wonNoDeliveryCount: 0,
      referralGapCount: 0,
      stageStallCount: 0,
    };
    await upsertNextActions(produceNextActions(ctx));
    const still = await db.nextBestAction.findUnique({ where: { id: action.id } });
    expect(still?.status).toBe(NextActionStatus.dismissed);
  });

  it("golden_nba_done_removes_from_open_counts: completed excludes from queued", async () => {
    const action = await db.nextBestAction.create({
      data: {
        title: "Golden done test",
        priority: NextActionPriority.medium,
        score: 55,
        status: NextActionStatus.queued,
        sourceType: RiskSourceType.proposal,
        dedupeKey: `nba:${SCOPE}:done_test`,
        createdByRule: SCOPE,
      },
    });
    await completeNextAction(action.id);
    const updated = await db.nextBestAction.findUnique({ where: { id: action.id } });
    expect(updated?.status).toBe(NextActionStatus.done);

    const queuedWithScope = await db.nextBestAction.count({
      where: { status: NextActionStatus.queued, dedupeKey: { contains: SCOPE } },
    });
    expect(queuedWithScope).toBe(0);
  });
});
