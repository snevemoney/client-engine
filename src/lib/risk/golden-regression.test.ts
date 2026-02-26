/**
 * Phase 4.0.1.5: Risk golden regression scenarios.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { RiskSeverity, RiskSourceType } from "@prisma/client";
import { evaluateRiskRules } from "./rules";
import { upsertRiskFlags } from "./service";
import type { RiskRuleContext } from "./types";

const SCOPE = "golden_risk";

describe("Risk golden regression", () => {
  beforeEach(async () => {
    await db.riskFlag.deleteMany({ where: { dedupeKey: { contains: SCOPE } } });
    await db.riskFlag.deleteMany({ where: { dedupeKey: { contains: "score_in_critical_band" } } });
    await db.notificationEvent.deleteMany({ where: { dedupeKey: { contains: "score_in_critical_band" } } });
    await db.scoreSnapshot.deleteMany({ where: { entityId: "command_center" } });
  });

  it("golden_risk_no_critical_no_notification: no critical band, no notification", async () => {
    const ctx: RiskRuleContext = {
      now: new Date(),
      failedDeliveryCount24h: 0,
      staleRunningJobsCount: 0,
      overdueRemindersHighCount: 0,
      commandCenterBand: null,
      proposalFollowupOverdueCount: 0,
      retentionOverdueCount: 0,
    };
    const candidates = evaluateRiskRules(ctx);
    expect(candidates).toHaveLength(0);

    const result = await upsertRiskFlags(candidates);
    expect(result.created).toBe(0);
    expect(result.criticalNotified).toBe(0);

    const riskNotifs = await db.notificationEvent.count({
      where: { eventKey: "risk.created.critical" },
    });
    expect(riskNotifs).toBe(0);
  });

  it("golden_risk_critical_creates_notification: critical band creates risk + notification", async () => {
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

    const ctx: RiskRuleContext = {
      now: new Date(),
      failedDeliveryCount24h: 0,
      staleRunningJobsCount: 0,
      overdueRemindersHighCount: 0,
      commandCenterBand: "critical",
      proposalFollowupOverdueCount: 0,
      retentionOverdueCount: 0,
    };
    const candidates = evaluateRiskRules(ctx);
    expect(candidates.some((c) => c.severity === RiskSeverity.critical)).toBe(true);

    const result = await upsertRiskFlags(candidates);
    expect(result.created).toBeGreaterThanOrEqual(1);
    expect(result.criticalNotified).toBeGreaterThanOrEqual(1);

    const notif = await db.notificationEvent.findFirst({
      where: { dedupeKey: { contains: "score_in_critical_band" } },
    });
    expect(notif?.dedupeKey).toMatch(/^risk:/);
  });

  it("golden_risk_rerun_is_idempotent: no duplicates, no double notifications", async () => {
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

    const ctx: RiskRuleContext = {
      now: new Date(),
      failedDeliveryCount24h: 0,
      staleRunningJobsCount: 0,
      overdueRemindersHighCount: 0,
      commandCenterBand: "critical",
      proposalFollowupOverdueCount: 0,
      retentionOverdueCount: 0,
    };
    const candidates = evaluateRiskRules(ctx);

    const r1 = await upsertRiskFlags(candidates);
    const r2 = await upsertRiskFlags(candidates);

    expect(r1.created).toBeGreaterThanOrEqual(1);
    expect(r2.created).toBe(0);
    expect(r2.updated).toBeGreaterThanOrEqual(1);

    const notifCount = await db.notificationEvent.count({
      where: { dedupeKey: { contains: "score_in_critical_band" } },
    });
    expect(notifCount).toBe(1);
  });

  it("golden_risk_dismiss_then_rerun_does_not_reopen", async () => {
    await db.riskFlag.deleteMany({ where: { dedupeKey: "risk:stale_running_jobs:system" } });
    const dedupeKey = "risk:stale_running_jobs:system";
    const risk = await db.riskFlag.create({
      data: {
        key: "stale_running_jobs:system",
        title: "Stale jobs",
        severity: RiskSeverity.high,
        status: "dismissed",
        sourceType: RiskSourceType.job,
        dedupeKey,
        createdByRule: "stale_running_jobs",
        lastSeenAt: new Date(),
      },
    });

    const ctx: RiskRuleContext = {
      now: new Date(),
      failedDeliveryCount24h: 0,
      staleRunningJobsCount: 5,
      overdueRemindersHighCount: 0,
      commandCenterBand: null,
      proposalFollowupOverdueCount: 0,
      retentionOverdueCount: 0,
    };
    const candidates = evaluateRiskRules(ctx);
    expect(candidates.some((c) => c.createdByRule === "stale_running_jobs")).toBe(true);

    await upsertRiskFlags(candidates);

    const updated = await db.riskFlag.findUnique({ where: { id: risk.id } });
    expect(updated?.status).toBe("dismissed");
  });
});
