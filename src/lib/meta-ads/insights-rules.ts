/**
 * Rule-based operator insights for Meta Ads (V1.1).
 * Deterministic heuristics — no ML. Thresholds from constants.
 */

import { META_ADS_INSIGHTS } from "./constants";
import type { MetaAdsSummary, MetaAdsCampaign, MetaAdsAdSet, MetaAdsAd, OperatorInsight } from "./types";

type PriorMetrics = { spend: number; leads: number; ctr: number; costPerLead: number | null };

function insight(
  severity: OperatorInsight["severity"],
  entityType: OperatorInsight["entityType"],
  entityId: string,
  entityName: string,
  message: string,
  suggestedAction: string
): OperatorInsight {
  return { severity, entityType, entityId, entityName, message, suggestedAction };
}

export function generateInsights(
  summary: MetaAdsSummary,
  campaigns: MetaAdsCampaign[],
  adsets: MetaAdsAdSet[],
  ads: MetaAdsAd[],
  priorMetrics?: PriorMetrics | null
): OperatorInsight[] {
  const out: OperatorInsight[] = [];
  const { HIGH_SPEND_NO_LEADS, FREQUENCY_FATIGUE_THRESHOLD, CPL_ABOVE_AVG_MULTIPLIER, LOW_CTR_BASELINE, MIN_SPEND_FOR_CTR, CPL_SPIKE_VS_PRIOR_MULTIPLIER, CTR_DROP_VS_PRIOR_RATIO, MIN_SPEND_FOR_CPL_SPIKE } = META_ADS_INSIGHTS;

  const avgCpl = summary.leads > 0 ? summary.costPerLead ?? summary.spend / summary.leads : null;
  const campaignsWithImpressions = campaigns.filter((c) => c.impressions > 0);
  const avgCtr = campaignsWithImpressions.length > 0 ? campaignsWithImpressions.reduce((s, c) => s + c.ctr, 0) / campaignsWithImpressions.length : summary.ctr;

  // High spend, zero leads (campaign/adset)
  for (const c of campaigns) {
    if (c.spend >= HIGH_SPEND_NO_LEADS && c.leads === 0 && c.effectiveStatus === "ACTIVE") {
      out.push(insight("warn", "campaign", c.id, c.name, `High spend ($${c.spend.toFixed(0)}) and no leads in selected period`, "Review targeting or creative; consider pausing if not learning."));
    }
  }
  for (const a of adsets) {
    if (a.spend >= HIGH_SPEND_NO_LEADS && a.leads === 0 && a.effectiveStatus === "ACTIVE") {
      out.push(insight("warn", "adset", a.id, a.name, `High spend ($${a.spend.toFixed(0)}) and no leads`, "Check audience or budget; may need new creative."));
    }
  }

  // Frequency fatigue
  for (const c of campaigns) {
    if (c.frequency != null && c.frequency > FREQUENCY_FATIGUE_THRESHOLD && c.ctr < avgCtr * 0.7 && c.impressions > 100) {
      out.push(insight("warn", "campaign", c.id, c.name, `Frequency ${c.frequency.toFixed(1)}, CTR below avg — possible fatigue`, "Consider refreshing creative or expanding audience."));
    }
  }

  // CPL above average
  if (avgCpl != null && avgCpl > 0) {
    for (const c of campaigns) {
      const cpl = c.costPerLead ?? (c.leads > 0 ? c.spend / c.leads : null);
      if (cpl != null && c.leads >= 1 && cpl > avgCpl * CPL_ABOVE_AVG_MULTIPLIER) {
        out.push(insight("info", "campaign", c.id, c.name, `CPL $${cpl.toFixed(0)} is >${Math.round(CPL_ABOVE_AVG_MULTIPLIER * 100)}% of account avg`, "Review audiences and creative resonance."));
      }
    }
  }

  // Top performers by CPL
  const withLeads = campaigns.filter((c) => c.leads >= 1);
  if (withLeads.length > 0) {
    const sorted = [...withLeads].sort((a, b) => {
      const cpla = a.costPerLead ?? (a.leads > 0 ? a.spend / a.leads : Infinity);
      const cplb = b.costPerLead ?? (b.leads > 0 ? b.spend / b.leads : Infinity);
      return cpla - cplb;
    });
    const top = sorted[0];
    const cpl = top.costPerLead ?? (top.leads > 0 ? top.spend / top.leads : null);
    if (cpl != null) {
      out.push(insight("info", "campaign", top.id, top.name, `Top performer by CPL ($${cpl.toFixed(0)}/lead, ${top.leads} leads)`, "Consider scaling budget or duplicating structure."));
    }
  }

  // Low CTR creative
  for (const ad of ads) {
    if (ad.spend >= MIN_SPEND_FOR_CTR && ad.impressions > 100 && ad.ctr < LOW_CTR_BASELINE && ad.effectiveStatus === "ACTIVE") {
      out.push(insight("info", "ad", ad.id, ad.name, `Low CTR (${ad.ctr.toFixed(2)}%) — consider replacing hook/creative`, "Test new headline or creative angle."));
    }
  }

  // LearningLimitedNeedsPatience (info)
  for (const c of campaigns) {
    if ((c.learningStatus === "LEARNING_LIMITED" || c.learningStatus === "LEARNING") && c.effectiveStatus === "ACTIVE") {
      out.push(insight("info", "campaign", c.id, c.name, "Learning limited — needs more data to optimize", "Allow 50+ conversions or 7 days; avoid frequent edits."));
    }
  }

  // NoDeliveryButActive (warn)
  for (const c of campaigns) {
    if (c.effectiveStatus === "ACTIVE" && (c.deliveryStatus === "NO_DELIVERY" || c.deliveryStatus === "UNDER_DELIVERY") && c.spend === 0) {
      out.push(insight("warn", "campaign", c.id, c.name, "Active but no delivery in period", "Check budget, audience size, or bidding."));
    }
  }
  for (const a of adsets) {
    if (a.effectiveStatus === "ACTIVE" && (a.deliveryStatus === "NO_DELIVERY" || a.deliveryStatus === "UNDER_DELIVERY") && a.spend === 0) {
      out.push(insight("warn", "adset", a.id, a.name, "Active but no delivery", "Check budget or audience."));
    }
  }

  // CPLSpikeVsPriorPeriod
  if (priorMetrics?.costPerLead != null && priorMetrics.costPerLead > 0 && summary.spend >= MIN_SPEND_FOR_CPL_SPIKE) {
    const cplCurrent = summary.costPerLead ?? (summary.leads > 0 ? summary.spend / summary.leads : null);
    if (cplCurrent != null && cplCurrent > priorMetrics.costPerLead * CPL_SPIKE_VS_PRIOR_MULTIPLIER) {
      out.push(insight("warn", "account", "account", "Account", `CPL up ${((cplCurrent / priorMetrics.costPerLead - 1) * 100).toFixed(0)}% vs prior period`, "Review recent changes; may need creative refresh."));
    }
  }

  // CTRDropVsPriorPeriod
  if (priorMetrics && priorMetrics.ctr > 0 && summary.impressions > 100 && summary.ctr < priorMetrics.ctr * CTR_DROP_VS_PRIOR_RATIO) {
    out.push(insight("info", "account", "account", "Account", `CTR down vs prior period (${summary.ctr.toFixed(2)}% vs ${priorMetrics.ctr.toFixed(2)}%)`, "Consider refreshing creative or audience."));
  }

  // Delivery / learning (legacy, if we have the field)
  for (const c of campaigns) {
    if (c.deliveryStatus === "UNDER_DELIVERY" && c.spend > 0) {
      out.push(insight("info", "campaign", c.id, c.name, "Under delivery", "May need more budget or audience size to exit learning."));
    }
  }

  // Paused campaign (informational)
  const paused = campaigns.filter((c) => c.effectiveStatus === "PAUSED");
  if (paused.length > 0 && campaigns.length <= 5) {
    out.push(insight("info", "account", "account", "Account", `${paused.length} paused campaign(s)`, "Re-activate if ready to run again."));
  }

  return out;
}
