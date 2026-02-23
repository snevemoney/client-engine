/**
 * Shared generate recommendations logic.
 * Used by POST /api/meta-ads/recommendations/generate and scheduler.
 */
import { db } from "@/lib/db";
import { fetchMetaAdsDashboard } from "@/lib/meta-ads/fetch";
import { generateRecommendations } from "@/lib/meta-ads/recommendations-rules";
import type { DateRangePreset } from "@/lib/meta-ads/types";

export type GenerateResult =
  | { ok: true; generated: number }
  | { ok: false; error: string; code?: string };

/**
 * Fetch dashboard data, run rules, persist queued recommendations.
 * Replaces today's queued recs with fresh generate.
 */
export async function runGenerateRecommendations(accountId: string): Promise<GenerateResult> {
  const acc = accountId.startsWith("act_") ? accountId : `act_${accountId}`;

  const result = await fetchMetaAdsDashboard(acc, "last_7d" as DateRangePreset, { skipCache: true });
  if (!result.ok) {
    return {
      ok: false,
      error: result.error ?? "Fetch failed",
      code: result.code,
    };
  }

  const settings = await db.metaAdsAutomationSettings.findUnique({
    where: { accountId: acc },
  });

  const settingsInput = settings
    ? {
        targetCpl: settings.targetCpl,
        minSpendForDecision: settings.minSpendForDecision,
        minImpressionsForDecision: settings.minImpressionsForDecision,
        maxBudgetIncreasePctPerAction: settings.maxBudgetIncreasePctPerAction,
        maxBudgetIncreasePctPerDay: settings.maxBudgetIncreasePctPerDay,
        allowChangesDuringLearning: settings.allowChangesDuringLearning,
        protectedCampaignIds: (settings.protectedCampaignIds as string[]) ?? [],
      }
    : undefined;

  const recs = generateRecommendations(
    result.summary,
    result.campaigns,
    result.adsets,
    result.ads,
    settingsInput
  );

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  await db.metaAdsRecommendation.deleteMany({
    where: {
      accountId: acc,
      status: "queued",
      createdAt: { gte: todayStart },
    },
  });

  const created = await db.metaAdsRecommendation.createMany({
    data: recs.map((r) => ({
      accountId: acc,
      entityType: r.entityType,
      entityId: r.entityId,
      campaignId: r.campaignId ?? null,
      entityName: r.entityName,
      ruleKey: r.ruleKey,
      severity: r.severity,
      confidence: r.confidence,
      status: "queued",
      actionType: r.actionType,
      actionPayload: r.actionPayload as object,
      evidence: r.evidence as object,
      reason: r.reason,
    })),
  });

  return { ok: true, generated: created.count };
}
