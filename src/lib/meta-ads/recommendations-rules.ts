/**
 * V3 Recommendations rules engine — pure logic, no network/DB.
 * Input: normalized dashboard data + settings.
 * Output: array of recommendation objects.
 */

import type {
  MetaAdsSummary,
  MetaAdsCampaign,
  MetaAdsAdSet,
  MetaAdsAd,
} from "./types";
import type { RecommendationOutput, AutomationSettingsInput } from "./recommendations-types";

const DEFAULTS: AutomationSettingsInput = {
  targetCpl: null,
  minSpendForDecision: 20,
  minImpressionsForDecision: 100,
  maxBudgetIncreasePctPerAction: 10,
  maxBudgetIncreasePctPerDay: 20,
  allowChangesDuringLearning: false,
  protectedCampaignIds: [],
};

type Entity = {
  entityType: "campaign" | "adset" | "ad";
  entityId: string;
  entityName: string;
  spend: number;
  impressions: number;
  leads: number;
  costPerLead: number | null;
  ctr: number;
  frequency: number | null;
  effectiveStatus: string;
  deliveryStatus: string | null;
  learningStatus: string | null;
  campaignId?: string;
};

function toEntity(c: MetaAdsCampaign): Entity {
  return {
    entityType: "campaign",
    entityId: c.id,
    entityName: c.name,
    spend: c.spend,
    impressions: c.impressions,
    leads: c.leads,
    costPerLead: c.costPerLead,
    ctr: c.ctr,
    frequency: c.frequency,
    effectiveStatus: c.effectiveStatus,
    deliveryStatus: c.deliveryStatus,
    learningStatus: c.learningStatus,
  };
}

function toEntityAdSet(a: MetaAdsAdSet): Entity {
  return {
    entityType: "adset",
    entityId: a.id,
    entityName: a.name,
    spend: a.spend,
    impressions: a.impressions,
    leads: a.leads,
    costPerLead: a.costPerLead,
    ctr: a.ctr,
    frequency: a.frequency,
    effectiveStatus: a.effectiveStatus,
    deliveryStatus: a.deliveryStatus,
    learningStatus: a.learningStatus,
    campaignId: a.campaignId,
  };
}

function toEntityAd(a: MetaAdsAd): Entity {
  return {
    entityType: "ad",
    entityId: a.id,
    entityName: a.name,
    spend: a.spend,
    impressions: a.impressions,
    leads: a.leads,
    costPerLead: a.costPerLead,
    ctr: a.ctr,
    frequency: a.frequency,
    effectiveStatus: a.effectiveStatus,
    deliveryStatus: a.deliveryStatus,
    learningStatus: a.learningStatus,
  };
}

function isLearning(e: Entity): boolean {
  return e.learningStatus === "LEARNING" || e.learningStatus === "LEARNING_LIMITED";
}

function isProtected(e: Entity, s: AutomationSettingsInput): boolean {
  if (e.entityType === "campaign" && s.protectedCampaignIds.includes(e.entityId)) return true;
  if (e.entityType === "adset" && e.campaignId && s.protectedCampaignIds.includes(e.campaignId)) return true;
  return false;
}

export function generateRecommendations(
  summary: MetaAdsSummary,
  campaigns: MetaAdsCampaign[],
  adsets: MetaAdsAdSet[],
  ads: MetaAdsAd[],
  settings: Partial<AutomationSettingsInput> = {}
): RecommendationOutput[] {
  const s = { ...DEFAULTS, ...settings };
  const out: RecommendationOutput[] = [];

  const allEntities: Entity[] = [
    ...campaigns.map(toEntity),
    ...adsets.map(toEntityAdSet),
    ...ads.map(toEntityAd),
  ].filter((e) => e.effectiveStatus === "ACTIVE");

  const avgCpl = summary.leads > 0 ? (summary.costPerLead ?? summary.spend / summary.leads) : null;
  const targetCpl = s.targetCpl ?? avgCpl;

  for (const e of allEntities) {
    if (isProtected(e, s)) continue;

    // Rule 1: no_leads_after_spend
    if (
      e.spend >= s.minSpendForDecision &&
      e.impressions >= s.minImpressionsForDecision &&
      e.leads === 0
    ) {
      const severity = e.spend >= 50 ? "critical" : "warn";
      out.push({
        ruleKey: "no_leads_after_spend",
        entityType: e.entityType,
        entityId: e.entityId,
        entityName: e.entityName,
        severity,
        confidence: e.spend >= 50 ? "high" : "medium",
        reason: `Spend $${e.spend.toFixed(0)}, ${e.impressions} impressions, no leads. Consider pausing.`,
        evidence: {
          spend: e.spend,
          leads: e.leads,
          impressions: e.impressions,
          ctr: e.ctr,
          frequency: e.frequency ?? undefined,
          delivery: e.deliveryStatus,
          learning: e.learningStatus,
        },
        actionType: "pause",
        actionPayload: {},
      });
      continue;
    }

    // Rule 4: learning_protection (check first — often "wait")
    if (isLearning(e) && !s.allowChangesDuringLearning) {
      out.push({
        ruleKey: "learning_protection",
        entityType: e.entityType,
        entityId: e.entityId,
        entityName: e.entityName,
        severity: "info",
        confidence: "high",
        reason: "In learning phase — avoid edits during learning.",
        evidence: {
          spend: e.spend,
          leads: e.leads,
          delivery: e.deliveryStatus,
          learning: e.learningStatus,
        },
        actionType: "wait",
        actionPayload: {},
      });
      continue;
    }

    // Rule 6: insufficient_data
    if (e.spend < s.minSpendForDecision || e.impressions < s.minImpressionsForDecision) {
      out.push({
        ruleKey: "insufficient_data",
        entityType: e.entityType,
        entityId: e.entityId,
        entityName: e.entityName,
        severity: "info",
        confidence: "high",
        reason: `Insufficient data (spend $${e.spend.toFixed(0)}, ${e.impressions} impressions). Wait for more.`,
        evidence: {
          spend: e.spend,
          leads: e.leads,
          impressions: e.impressions,
        },
        actionType: "wait",
        actionPayload: {},
      });
      continue;
    }

    // Rule 2: high_cpl
    if (targetCpl != null && targetCpl > 0 && e.leads > 0) {
      const cpl = e.costPerLead ?? e.spend / e.leads;
      if (cpl > targetCpl * 2) {
        out.push({
          ruleKey: "high_cpl",
          entityType: e.entityType,
          entityId: e.entityId,
          entityName: e.entityName,
          severity: "critical",
          confidence: "high",
          reason: `CPL $${cpl.toFixed(0)} is >2x target ($${targetCpl.toFixed(0)}). Consider pause or reduce budget.`,
          evidence: {
            spend: e.spend,
            leads: e.leads,
            cpl,
            ctr: e.ctr,
          },
          actionType: "decrease_budget",
          actionPayload: { percentDecrease: 20 },
        });
        continue;
      }
      if (cpl > targetCpl * 1.5) {
        out.push({
          ruleKey: "high_cpl",
          entityType: e.entityType,
          entityId: e.entityId,
          entityName: e.entityName,
          severity: "warn",
          confidence: "medium",
          reason: `CPL $${cpl.toFixed(0)} is >1.5x target ($${targetCpl.toFixed(0)}).`,
          evidence: {
            spend: e.spend,
            leads: e.leads,
            cpl,
            ctr: e.ctr,
          },
          actionType: "decrease_budget",
          actionPayload: { percentDecrease: 10 },
        });
        continue;
      }
    }

    // Rule 3: fatigue_detected (ad-level preferred)
    if (
      e.frequency != null &&
      e.frequency > 2.5 &&
      e.impressions >= 100 &&
      e.ctr < 0.6
    ) {
      out.push({
        ruleKey: "fatigue_detected",
        entityType: e.entityType,
        entityId: e.entityId,
        entityName: e.entityName,
        severity: "warn",
        confidence: "medium",
        reason: `Frequency ${e.frequency.toFixed(1)}, CTR ${e.ctr.toFixed(2)}% — possible creative fatigue. Refresh creative (manual).`,
        evidence: {
          spend: e.spend,
          impressions: e.impressions,
          ctr: e.ctr,
          frequency: e.frequency,
        },
        actionType: "refresh_creative",
        actionPayload: {},
      });
      continue;
    }

    // Rule 5: winner_scale_candidate
    if (
      e.leads >= 2 &&
      targetCpl != null &&
      targetCpl > 0 &&
      (e.costPerLead ?? (e.leads > 0 ? e.spend / e.leads : null)) != null &&
      (e.costPerLead ?? e.spend / e.leads) <= targetCpl &&
      !isLearning(e)
    ) {
      const pct = Math.min(s.maxBudgetIncreasePctPerAction, 10);
      out.push({
        ruleKey: "winner_scale_candidate",
        entityType: e.entityType,
        entityId: e.entityId,
        entityName: e.entityName,
        severity: "info",
        confidence: "medium",
        reason: `Good CPL, ${e.leads} leads — consider scaling budget +${pct}%.`,
        evidence: {
          spend: e.spend,
          leads: e.leads,
          cpl: e.costPerLead ?? e.spend / e.leads,
          ctr: e.ctr,
        },
        actionType: "increase_budget",
        actionPayload: { percentIncrease: pct },
      });
    }
  }

  return out;
}
