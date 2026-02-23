/**
 * Shared apply logic for Meta Ads recommendations.
 * Used by POST /api/meta-ads/recommendations/[id]/apply and scheduler.
 * All guardrails and action logging go through this path.
 * In META_MODE=mock, never calls Meta API; always returns simulated.
 */
import { db } from "@/lib/db";
import { getMetaMode } from "@/lib/meta-ads/mode";
import { executeMetaAction } from "@/lib/meta-ads/actions-client";
import {
  checkProtected,
  checkCooldown,
  checkDailyCap,
  buildEvidenceMessage,
} from "@/lib/meta-ads/apply-guardrails";

export type ApplyOutcome = "success" | "simulated" | "blocked" | "failed" | "skipped";

export type ApplyResult =
  | { ok: true; outcome: "success" | "simulated"; simulated?: boolean }
  | { ok: false; outcome: "blocked" | "failed"; error: string }
  | { ok: false; outcome: "skipped"; error: string; code?: "not_found" | "forbidden" | "bad_status" | "non_executable" };

/**
 * Apply a recommendation by ID. Enforces all guardrails. Writes ActionLog.
 * @param recommendationId - Recommendation ID
 * @param options.triggeredBy - "user" | "rule_engine" (scheduler)
 * @param options.forceQueued - If true, allow apply from queued without prior approve
 */
export async function applyRecommendation(
  recommendationId: string,
  options: { triggeredBy?: "user" | "rule_engine"; forceQueued?: boolean } = {}
): Promise<ApplyResult> {
  const triggeredBy = options.triggeredBy ?? "user";
  const forceQueued = options.forceQueued ?? false;

  const rec = await db.metaAdsRecommendation.findUnique({ where: { id: recommendationId } });
  if (!rec) return { ok: false, outcome: "skipped", error: "Recommendation not found", code: "not_found" };

  const mode = getMetaMode();
  let accountId = process.env.META_AD_ACCOUNT_ID?.trim();
  if (mode === "mock" && !accountId) accountId = "act_mock";
  const acc = accountId?.startsWith("act_") ? accountId : accountId ? `act_${accountId}` : null;
  if (!acc || acc !== rec.accountId) {
    return { ok: false, outcome: "skipped", error: "Forbidden", code: "forbidden" };
  }

  if (rec.status === "false_positive") {
    return { ok: false, outcome: "skipped", error: "Marked as false positive", code: "bad_status" };
  }
  if (rec.status !== "approved" && rec.status !== "queued") {
    return { ok: false, outcome: "skipped", error: `Cannot apply from status ${rec.status}`, code: "bad_status" };
  }
  if (rec.status === "queued" && !forceQueued) {
    return { ok: false, outcome: "skipped", error: "Approve first", code: "bad_status" };
  }

  const actionType = rec.actionType as string;
  const executable = ["pause", "resume", "increase_budget", "decrease_budget"].includes(actionType);
  if (!executable) {
    return { ok: false, outcome: "skipped", error: `Action ${actionType} is not executable`, code: "non_executable" };
  }

  const settings = await db.metaAdsAutomationSettings.findUnique({ where: { accountId: rec.accountId } });
  const dryRun = settings?.dryRun ?? true;

  const protectedCheck = checkProtected(rec, settings);
  if (!protectedCheck.ok) {
    const evidenceMsg = buildEvidenceMessage(
      (rec.evidence as Record<string, unknown>) ?? {},
      rec.ruleKey,
      rec.severity,
      rec.confidence
    );
    await db.metaAdsActionLog.create({
      data: {
        recommendationId: rec.id,
        accountId: rec.accountId,
        entityType: rec.entityType,
        entityId: rec.entityId,
        entityName: rec.entityName,
        actionType: rec.actionType,
        actionPayload: rec.actionPayload as object,
        mode: settings?.mode ?? "manual",
        triggeredBy,
        dryRun,
        status: "blocked",
        message: `${protectedCheck.reason}${evidenceMsg ? ` | ${evidenceMsg}` : ""}`,
      },
    });
    return { ok: false, outcome: "blocked", error: protectedCheck.reason };
  }

  const cooldownMins = settings?.actionCooldownMinutes ?? 720;
  const cooldownCutoff = new Date(Date.now() - cooldownMins * 60 * 1000);
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [recentForCooldown, todayForCap] = await Promise.all([
    db.metaAdsActionLog.findMany({
      where: {
        accountId: rec.accountId,
        entityType: rec.entityType,
        entityId: rec.entityId,
        createdAt: { gte: cooldownCutoff },
      },
      select: { status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    db.metaAdsActionLog.findMany({
      where: {
        accountId: rec.accountId,
        entityType: rec.entityType,
        entityId: rec.entityId,
        createdAt: { gte: todayStart },
      },
      select: { status: true },
    }),
  ]);

  const cooldownCheck = checkCooldown(rec.accountId, rec.entityType, rec.entityId, settings, recentForCooldown);
  if (!cooldownCheck.ok) {
    const evidenceMsg = buildEvidenceMessage(
      (rec.evidence as Record<string, unknown>) ?? {},
      rec.ruleKey,
      rec.severity,
      rec.confidence
    );
    await db.metaAdsActionLog.create({
      data: {
        recommendationId: rec.id,
        accountId: rec.accountId,
        entityType: rec.entityType,
        entityId: rec.entityId,
        entityName: rec.entityName,
        actionType: rec.actionType,
        actionPayload: rec.actionPayload as object,
        mode: settings?.mode ?? "manual",
        triggeredBy,
        dryRun,
        status: "blocked",
        message: `${cooldownCheck.reason}${evidenceMsg ? ` | ${evidenceMsg}` : ""}`,
      },
    });
    return { ok: false, outcome: "blocked", error: cooldownCheck.reason };
  }

  const capCheck = checkDailyCap(rec.entityType, rec.entityId, settings, todayForCap);
  if (!capCheck.ok) {
    const evidenceMsg = buildEvidenceMessage(
      (rec.evidence as Record<string, unknown>) ?? {},
      rec.ruleKey,
      rec.severity,
      rec.confidence
    );
    await db.metaAdsActionLog.create({
      data: {
        recommendationId: rec.id,
        accountId: rec.accountId,
        entityType: rec.entityType,
        entityId: rec.entityId,
        entityName: rec.entityName,
        actionType: rec.actionType,
        actionPayload: rec.actionPayload as object,
        mode: settings?.mode ?? "manual",
        triggeredBy,
        dryRun,
        status: "blocked",
        message: `${capCheck.reason}${evidenceMsg ? ` | ${evidenceMsg}` : ""}`,
      },
    });
    return { ok: false, outcome: "blocked", error: capCheck.reason };
  }

  const payload = (rec.actionPayload as { percentIncrease?: number; percentDecrease?: number }) ?? {};
  let result: Awaited<ReturnType<typeof executeMetaAction>>;
  if (mode === "mock") {
    result = {
      ok: true,
      entityType: rec.entityType,
      entityId: rec.entityId,
      actionType: actionType as "pause" | "resume" | "increase_budget" | "decrease_budget",
      requestPayload: { status: actionType === "pause" ? "PAUSED" : "ACTIVE" },
      responseSummary: `[Mock mode] Simulated ${actionType} for ${rec.entityName}`,
      simulated: true,
    };
  } else {
    result = await executeMetaAction(
      rec.entityType as "campaign" | "adset" | "ad",
      rec.entityId,
      rec.entityName,
      actionType as "pause" | "resume" | "increase_budget" | "decrease_budget",
      payload,
      dryRun
    );
  }

  const logStatus = result.ok
    ? result.simulated
      ? "simulated"
      : "success"
    : "failed";

  const evidenceMsg = buildEvidenceMessage(
    (rec.evidence as Record<string, unknown>) ?? {},
    rec.ruleKey,
    rec.severity,
    rec.confidence
  );
  const logMessage = result.ok
    ? `${result.responseSummary}${evidenceMsg ? ` | ${evidenceMsg}` : ""}`
    : result.error ?? "";

  await db.metaAdsActionLog.create({
    data: {
      recommendationId: rec.id,
      accountId: rec.accountId,
      entityType: rec.entityType,
      entityId: rec.entityId,
      entityName: rec.entityName,
      actionType: rec.actionType,
      actionPayload: rec.actionPayload as object,
      mode: settings?.mode ?? "manual",
      triggeredBy,
      dryRun,
      status: logStatus,
      message: logMessage,
      metaResponse: result.ok && !result.simulated ? (result.requestPayload as object) : undefined,
    },
  });

  if (result.ok) {
    await db.metaAdsRecommendation.update({
      where: { id: recommendationId },
      data: {
        status: result.simulated ? "approved" : "applied",
        appliedAt: result.simulated ? undefined : new Date(),
        updatedAt: new Date(),
      },
    });
    return { ok: true, outcome: result.simulated ? "simulated" : "success", simulated: result.simulated };
  } else {
    await db.metaAdsRecommendation.update({
      where: { id: recommendationId },
      data: { status: "failed", updatedAt: new Date() },
    });
    return { ok: false, outcome: "failed", error: result.error ?? "Unknown error" };
  }
}
