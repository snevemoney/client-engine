/**
 * POST /api/meta-ads/recommendations/[id]/apply
 * Executes Meta action. Respects settings dryRun. Enforces guardrails. Writes action log.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { executeMetaAction } from "@/lib/meta-ads/actions-client";
import {
  checkProtected,
  checkCooldown,
  checkDailyCap,
  buildEvidenceMessage,
} from "@/lib/meta-ads/apply-guardrails";
import { z } from "zod";

const BodySchema = z.object({
  forceQueued: z.boolean().optional().default(false),
});

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/meta-ads/recommendations/[id]/apply", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    let body: z.infer<typeof BodySchema>;
    try {
      const json = await req.json().catch(() => ({}));
      body = BodySchema.parse(json);
    } catch (e) {
      return jsonError(
        e instanceof z.ZodError ? e.issues.map((err) => err.message).join("; ") : "Invalid body",
        400
      );
    }

    const rec = await db.metaAdsRecommendation.findUnique({ where: { id } });
    if (!rec) return jsonError("Recommendation not found", 404);

    const accountId = process.env.META_AD_ACCOUNT_ID?.trim();
    if (!accountId || (accountId.startsWith("act_") ? accountId : `act_${accountId}`) !== rec.accountId) {
      return jsonError("Forbidden", 403);
    }

    if (rec.status === "false_positive") {
      return jsonError("Cannot apply: marked as false positive. Reset first to re-approve.", 400);
    }
    if (rec.status !== "approved" && rec.status !== "queued") {
      return jsonError(`Cannot apply from status ${rec.status}. Approve first.`, 400);
    }
    if (rec.status === "queued" && !body.forceQueued) {
      return jsonError("Recommendation not approved. Approve first or pass forceQueued: true.", 400);
    }

    const settings = await db.metaAdsAutomationSettings.findUnique({
      where: { accountId: rec.accountId },
    });
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
          triggeredBy: "user",
          dryRun,
          status: "blocked",
          message: `${protectedCheck.reason}${evidenceMsg ? ` | ${evidenceMsg}` : ""}`,
        },
      });
      return jsonError(protectedCheck.reason, 409);
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

    const cooldownCheck = checkCooldown(
      rec.accountId,
      rec.entityType,
      rec.entityId,
      settings,
      recentForCooldown
    );
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
          triggeredBy: "user",
          dryRun,
          status: "blocked",
          message: `${cooldownCheck.reason}${evidenceMsg ? ` | ${evidenceMsg}` : ""}`,
        },
      });
      return jsonError(cooldownCheck.reason, 409);
    }

    const capCheck = checkDailyCap(
      rec.entityType,
      rec.entityId,
      settings,
      todayForCap
    );
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
          triggeredBy: "user",
          dryRun,
          status: "blocked",
          message: `${capCheck.reason}${evidenceMsg ? ` | ${evidenceMsg}` : ""}`,
        },
      });
      return jsonError(capCheck.reason, 409);
    }

    const actionType = rec.actionType as "pause" | "resume" | "increase_budget" | "decrease_budget";
    if (
      actionType !== "pause" &&
      actionType !== "resume" &&
      actionType !== "increase_budget" &&
      actionType !== "decrease_budget"
    ) {
      return jsonError(`Action ${rec.actionType} is recommendation-only, cannot apply.`, 400);
    }

    const payload = (rec.actionPayload as { percentIncrease?: number; percentDecrease?: number }) ?? {};
    const result = await executeMetaAction(
      rec.entityType as "campaign" | "adset" | "ad",
      rec.entityId,
      rec.entityName,
      actionType,
      payload,
      dryRun
    );

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
        triggeredBy: "user",
        dryRun,
        status: logStatus,
        message: logMessage,
        metaResponse: result.ok && !result.simulated ? (result.requestPayload as object) : undefined,
      },
    });

    if (result.ok) {
      await db.metaAdsRecommendation.update({
        where: { id },
        data: {
          status: result.simulated ? "approved" : "applied",
          appliedAt: result.simulated ? undefined : new Date(),
          updatedAt: new Date(),
        },
      });
    } else {
      await db.metaAdsRecommendation.update({
        where: { id },
        data: { status: "failed", updatedAt: new Date() },
      });
    }

    return NextResponse.json({
      ok: result.ok,
      result: result.ok
        ? {
            entityType: result.entityType,
            entityId: result.entityId,
            actionType: result.actionType,
            responseSummary: result.responseSummary,
            simulated: result.simulated,
            dryRun,
          }
        : undefined,
      error: !result.ok ? result.error : undefined,
    });
  });
}
