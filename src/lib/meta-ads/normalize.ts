/**
 * Normalizes raw Meta Graph API responses to stable internal types.
 * Safely extracts leads from actions/cost_per_action_type.
 */

import type { MetaAdsSummary, MetaAdsCampaign, MetaAdsAdSet, MetaAdsAd } from "./types";

type RawInsight = {
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  actions?: Array<{ action_type: string; value?: string }>;
  cost_per_action_type?: Array<{ action_type: string; value?: string }>;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  frequency?: string;
  ad_id?: string;
  adset_id?: string;
  campaign_id?: string;
  [key: string]: unknown;
};

const num = (v: string | number | null | undefined): number =>
  v == null || v === "" ? 0 : typeof v === "number" ? v : parseFloat(String(v)) || 0;

/** Extract lead count from actions array. Meta uses action_type "lead". */
export function parseLeads(actions: RawInsight["actions"]): number {
  if (!Array.isArray(actions)) return 0;
  const lead = actions.find((a) => (a?.action_type ?? "").toLowerCase() === "lead");
  return lead?.value != null ? num(lead.value) : 0;
}

/** Extract cost per lead from cost_per_action_type. */
export function parseCostPerLead(costPerActionType: RawInsight["cost_per_action_type"]): number | null {
  if (!Array.isArray(costPerActionType)) return null;
  const lead = costPerActionType.find((a) => (a?.action_type ?? "").toLowerCase() === "lead");
  if (lead?.value == null || lead.value === "") return null;
  const val = num(lead.value);
  return val > 0 ? val : null;
}

/** Use link_click as primary click metric; fall back to clicks field. */
export function parseClicks(actions: RawInsight["actions"], rawClicks?: string): number {
  if (Array.isArray(actions)) {
    const linkClick = actions.find((a) => (a?.action_type ?? "").toLowerCase() === "link_click");
    if (linkClick?.value != null) return num(linkClick.value);
  }
  return num(rawClicks);
}

export type PriorMetrics = {
  spend: number;
  leads: number;
  ctr: number;
  costPerLead: number | null;
  frequency: number | null;
};

/** Parse raw insight to prior metrics for trend delta computation. */
export function parseRawToPriorMetrics(raw: RawInsight): PriorMetrics {
  const spend = num(raw.spend);
  const leads = parseLeads(raw.actions);
  const impressions = num(raw.impressions);
  const clicks = parseClicks(raw.actions, raw.clicks);
  const ctr = num(raw.ctr) || (impressions > 0 && clicks > 0 ? (clicks / impressions) * 100 : 0);
  const costPerLead = parseCostPerLead(raw.cost_per_action_type) ?? (leads > 0 ? spend / leads : null);
  const frequency = raw.frequency != null && raw.frequency !== "" ? num(raw.frequency) : null;
  return { spend, leads, ctr, costPerLead, frequency };
}

function safeDeltaPct(current: number, prior: number): number | null {
  if (prior === 0) return null;
  return ((current - prior) / prior) * 100;
}

export function normalizeInsightToRow(
  raw: RawInsight,
  base: {
    id: string;
    name: string;
    status?: string;
    effective_status?: string;
    objective?: string;
    delivery_info?: { status?: string };
    learning_type_info?: { learning_type?: string };
    review_feedback?: { abstract_message?: string };
  },
  prior?: PriorMetrics
): MetaAdsCampaign {
  const spend = num(raw.spend);
  const impressions = num(raw.impressions);
  const reach = raw.reach != null && raw.reach !== "" ? num(raw.reach) : null;
  const clicks = parseClicks(raw.actions, raw.clicks);
  const leads = parseLeads(raw.actions);
  const cpc = num(raw.cpc);
  const cpm = num(raw.cpm);
  const ctr = num(raw.ctr);
  const frequency = raw.frequency != null && raw.frequency !== "" ? num(raw.frequency) : null;

  const ctrVal = ctr > 0 ? ctr : impressions > 0 && clicks > 0 ? (clicks / impressions) * 100 : 0;
  const cpcVal = cpc > 0 ? cpc : clicks > 0 ? spend / clicks : 0;
  const cpmVal = cpm > 0 ? cpm : impressions > 0 ? (spend / impressions) * 1000 : 0;
  const cplVal = leads > 0 ? spend / leads : parseCostPerLead(raw.cost_per_action_type);

  const row: MetaAdsCampaign = {
    id: base.id,
    name: base.name,
    status: base.status ?? "UNKNOWN",
    effectiveStatus: base.effective_status ?? base.status ?? "UNKNOWN",
    objective: base.objective ?? null,
    spend,
    impressions,
    reach,
    clicks,
    leads,
    ctr: ctrVal,
    cpc: cpcVal,
    cpm: cpmVal,
    frequency,
    costPerLead: cplVal,
    deliveryStatus: base.delivery_info?.status ?? (raw as RawInsight & { delivery_info?: { status?: string } }).delivery_info?.status ?? null,
    learningStatus: base.learning_type_info?.learning_type ?? (raw as RawInsight & { learning_type_info?: { learning_type?: string } }).learning_type_info?.learning_type ?? null,
    reviewStatus: base.review_feedback?.abstract_message ?? null,
  };

  if (prior) {
    row.spendDeltaPct = safeDeltaPct(spend, prior.spend);
    row.leadsDeltaPct = prior.leads > 0 ? safeDeltaPct(leads, prior.leads) : null;
    row.ctrDeltaPct = prior.ctr > 0 ? safeDeltaPct(ctrVal, prior.ctr) : null;
    row.cplDeltaPct =
      prior.costPerLead != null && prior.costPerLead > 0 && cplVal != null
        ? safeDeltaPct(cplVal, prior.costPerLead)
        : null;
    row.frequencyDeltaPct =
      prior.frequency != null && prior.frequency > 0 && frequency != null
        ? safeDeltaPct(frequency, prior.frequency)
        : null;
  }

  return row;
}

export function aggregateSummary(
  rows: Array<{ spend: number; impressions: number; reach: number | null; clicks: number; leads: number }>,
  deltas?: {
    spendDeltaPct?: number | null;
    leadsDeltaPct?: number | null;
    cplDeltaPct?: number | null;
    ctrDeltaPct?: number | null;
    cpcDeltaPct?: number | null;
    cpmDeltaPct?: number | null;
    frequencyDeltaPct?: number | null;
  }
): MetaAdsSummary {
  let spend = 0;
  let impressions = 0;
  let reach = 0;
  let clicks = 0;
  let leads = 0;
  let reachCount = 0;
  for (const r of rows) {
    spend += r.spend;
    impressions += r.impressions;
    clicks += r.clicks;
    leads += r.leads;
    if (r.reach != null && r.reach > 0) {
      reach += r.reach;
      reachCount++;
    }
  }
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const costPerLead = leads > 0 ? spend / leads : null;
  return {
    spend,
    impressions,
    reach: reachCount > 0 ? reach : null,
    clicks,
    leads,
    ctr,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    frequency: impressions > 0 && reach > 0 ? impressions / reach : null,
    costPerLead,
    spendDeltaPct: deltas?.spendDeltaPct ?? null,
    leadsDeltaPct: deltas?.leadsDeltaPct ?? null,
    cplDeltaPct: deltas?.cplDeltaPct ?? null,
    ctrDeltaPct: deltas?.ctrDeltaPct ?? null,
    cpcDeltaPct: deltas?.cpcDeltaPct ?? null,
    cpmDeltaPct: deltas?.cpmDeltaPct ?? null,
    frequencyDeltaPct: deltas?.frequencyDeltaPct ?? null,
  };
}
