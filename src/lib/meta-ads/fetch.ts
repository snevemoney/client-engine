/**
 * Fetches and normalizes Meta Ads dashboard data.
 * Orchestrates client + normalize + insights. Supports cache and trend comparison.
 */

import {
  fetchAccountInsights,
  fetchAccountInsightsTimeRange,
  fetchCampaignsWithInsights,
  fetchAdSetsWithInsights,
  fetchAdsWithInsights,
} from "./client";
import { aggregateSummary, normalizeInsightToRow, parseLeads, parseClicks, parseCostPerLead } from "./normalize";
import { generateInsights } from "./insights-rules";
import { getCached, setCached } from "./cache";
import type {
  MetaAdsDashboardData,
  MetaAdsDashboardError,
  MetaAdsSummary,
  MetaAdsCampaign,
  MetaAdsAdSet,
  MetaAdsAd,
  DateRangePreset,
} from "./types";

function toDateRange(preset: DateRangePreset): { since: string; until: string } {
  const now = new Date();
  const start = new Date(now);
  switch (preset) {
    case "today":
      start.setHours(0, 0, 0, 0);
      break;
    case "yesterday":
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      break;
    case "last_7d":
      start.setDate(start.getDate() - 7);
      break;
    case "last_14d":
      start.setDate(start.getDate() - 14);
      break;
    case "last_30d":
      start.setDate(start.getDate() - 30);
      break;
  }
  let until = now.toISOString().slice(0, 10);
  if (preset === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    until = y.toISOString().slice(0, 10);
  }
  return { since: start.toISOString().slice(0, 10), until };
}

/** Prior period time range for trend comparison. */
function priorPeriodTimeRange(preset: DateRangePreset): { since: string; until: string } | null {
  const current = toDateRange(preset);
  const untilDate = new Date(current.until);
  const sinceDate = new Date(current.since);
  const days = Math.ceil((untilDate.getTime() - sinceDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;

  const priorUntil = new Date(sinceDate);
  priorUntil.setDate(priorUntil.getDate() - 1);
  const priorSince = new Date(priorUntil);
  priorSince.setDate(priorSince.getDate() - days + 1);

  return {
    since: priorSince.toISOString().slice(0, 10),
    until: priorUntil.toISOString().slice(0, 10),
  };
}

function safeDeltaPct(current: number, prior: number): number | null {
  if (prior === 0) return null;
  return ((current - prior) / prior) * 100;
}

function parseRawInsightToSummary(raw: Record<string, unknown>): { spend: number; leads: number; ctr: number; costPerLead: number | null } {
  const spend = parseFloat(String(raw.spend ?? 0)) || 0;
  const leads = parseLeads(raw.actions as { action_type: string; value?: string }[]);
  const impressions = parseInt(String(raw.impressions ?? 0), 10) || 0;
  const clicks = parseClicks(raw.actions as { action_type: string; value?: string }[], String(raw.clicks));
  const ctr = parseFloat(String(raw.ctr ?? 0)) || (impressions > 0 && clicks > 0 ? (clicks / impressions) * 100 : 0);
  const costPerLead = parseCostPerLead(raw.cost_per_action_type as { action_type: string; value?: string }[]) ?? (leads > 0 ? spend / leads : null);
  return { spend, leads, ctr, costPerLead };
}

export async function fetchMetaAdsDashboard(
  accountId: string,
  range: DateRangePreset = "last_7d",
  options?: { skipCache?: boolean }
): Promise<MetaAdsDashboardData | MetaAdsDashboardError> {
  const token = process.env.META_ACCESS_TOKEN?.trim();
  const account = process.env.META_AD_ACCOUNT_ID?.trim() || accountId;

  if (!token) {
    return { ok: false, error: "META_ACCESS_TOKEN not configured", code: "NO_TOKEN" };
  }

  const acc = account.startsWith("act_") ? account : `act_${account}`;

  if (!options?.skipCache) {
    const cached = getCached<MetaAdsDashboardData>(acc, range);
    if (cached) {
      return { ...cached, cacheHit: true, lastSyncedAt: cached.lastFetchedAt };
    }
  }

  try {
    const priorRange = priorPeriodTimeRange(range);
    const [accountInsights, priorInsights, campaigns, adsets, ads] = await Promise.all([
      fetchAccountInsights(acc, range),
      priorRange ? fetchAccountInsightsTimeRange(acc, priorRange.since, priorRange.until) : Promise.resolve({ data: [] }),
      fetchCampaignsWithInsights(acc, range),
      fetchAdSetsWithInsights(acc, range),
      fetchAdsWithInsights(acc, range),
    ]);

    const rawAccountInsight = Array.isArray(accountInsights?.data) && accountInsights.data.length > 0
      ? (accountInsights.data[0] as Record<string, unknown>)
      : {};
    const priorRaw = Array.isArray(priorInsights?.data) && priorInsights.data.length > 0
      ? (priorInsights.data[0] as Record<string, unknown>)
      : null;

    const currentMetrics = parseRawInsightToSummary(rawAccountInsight);
    const priorMetrics = priorRaw ? parseRawInsightToSummary(priorRaw) : null;

    const spendDeltaPct = priorMetrics ? safeDeltaPct(currentMetrics.spend, priorMetrics.spend) : null;
    const leadsDeltaPct = priorMetrics ? safeDeltaPct(currentMetrics.leads, priorMetrics.leads) : null;
    const ctrDeltaPct = priorMetrics ? safeDeltaPct(currentMetrics.ctr, priorMetrics.ctr) : null;
    const cplPrior = priorMetrics?.costPerLead ?? null;
    const cplCurrent = currentMetrics.costPerLead;
    const cplDeltaPct = cplPrior != null && cplPrior > 0 && cplCurrent != null ? safeDeltaPct(cplCurrent, cplPrior) : null;

    const summary: MetaAdsSummary = {
      spend: currentMetrics.spend,
      impressions: parseInt(String(rawAccountInsight.impressions ?? 0), 10) || 0,
      reach: rawAccountInsight.reach != null ? parseInt(String(rawAccountInsight.reach), 10) : null,
      clicks: parseClicks(rawAccountInsight.actions as { action_type: string; value?: string }[], String(rawAccountInsight.clicks)),
      leads: currentMetrics.leads,
      ctr: currentMetrics.ctr,
      cpc: parseFloat(String(rawAccountInsight.cpc ?? 0)) || 0,
      cpm: parseFloat(String(rawAccountInsight.cpm ?? 0)) || 0,
      frequency: rawAccountInsight.frequency != null ? parseFloat(String(rawAccountInsight.frequency)) : null,
      costPerLead: currentMetrics.costPerLead,
      spendDeltaPct,
      leadsDeltaPct,
      cplDeltaPct,
      ctrDeltaPct,
    };

    const normCampaigns: MetaAdsCampaign[] = campaigns.map((c) =>
      normalizeInsightToRow(
        (c.insight ?? {}) as Parameters<typeof normalizeInsightToRow>[0],
        {
          id: c.id,
          name: c.name,
          status: c.status,
          effective_status: c.effective_status,
          objective: c.objective,
          delivery_info: c.delivery_info,
          learning_type_info: c.learning_type_info,
          review_feedback: c.review_feedback,
        }
      )
    );

    if (summary.impressions === 0 && summary.spend === 0 && normCampaigns.length > 0) {
      const fallback = aggregateSummary(normCampaigns, { spendDeltaPct, leadsDeltaPct, cplDeltaPct, ctrDeltaPct });
      if (fallback.impressions > 0 || fallback.spend > 0) {
        Object.assign(summary, fallback);
      }
    }

    const normAdsets: MetaAdsAdSet[] = adsets.map((a) => {
      const row = normalizeInsightToRow(
        (a.insight ?? {}) as Parameters<typeof normalizeInsightToRow>[0],
        {
          id: a.id,
          name: a.name,
          status: a.status,
          effective_status: a.effective_status,
          objective: a.objective,
          delivery_info: a.delivery_info,
          learning_type_info: a.learning_type_info,
        }
      );
      return { ...row, campaignId: a.campaign_id ?? "" };
    });

    const adSetToCampaign = new Map<string, string>();
    for (const aset of adsets) {
      const cid = (aset as { campaign_id?: string }).campaign_id;
      if (cid) adSetToCampaign.set(aset.id, cid);
    }
    const normAds: MetaAdsAd[] = ads.map((a) => {
      const row = normalizeInsightToRow(
        (a.insight ?? {}) as Parameters<typeof normalizeInsightToRow>[0],
        {
          id: a.id,
          name: a.name,
          status: a.status,
          effective_status: a.effective_status,
          objective: undefined,
          delivery_info: a.delivery_info,
          learning_type_info: a.learning_type_info,
        }
      );
      const adsetId = a.adset_id ?? "";
      return {
        ...row,
        adSetId: adsetId,
        campaignId: adSetToCampaign.get(adsetId),
        creativeId: a.creative?.id ?? null,
        thumbnailUrl: a.thumbnailUrl ?? null,
      };
    });

    const insights = generateInsights(summary, normCampaigns, normAdsets, normAds, priorMetrics);

    const result: MetaAdsDashboardData = {
      ok: true,
      accountId: acc,
      range: toDateRange(range),
      datePreset: range,
      lastFetchedAt: new Date().toISOString(),
      summary,
      campaigns: normCampaigns,
      adsets: normAdsets,
      ads: normAds,
      insights,
    };

    setCached(acc, range, result);
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[meta-ads] fetch error:", msg);
    let code: string = "API_ERROR";
    if (msg.toLowerCase().includes("token") || msg.includes("Invalid OAuth") || msg.includes("expired")) {
      code = "INVALID_TOKEN";
    } else if (msg.includes("permission") || msg.includes("(#100)") || msg.includes("access")) {
      code = "PERMISSION_DENIED";
    } else if (msg.includes("rate") || msg.includes("throttl") || msg.includes("limit")) {
      code = "RATE_LIMIT";
    }
    return { ok: false, error: msg, code };
  }
}
