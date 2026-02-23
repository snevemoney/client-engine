/**
 * Fetches and normalizes Meta Ads dashboard data.
 * Orchestrates client + normalize + insights.
 */

import {
  fetchAccountInsights,
  fetchCampaignsWithInsights,
  fetchAdSetsWithInsights,
  fetchAdsWithInsights,
} from "./client";
import { aggregateSummary, normalizeInsightToRow, parseLeads, parseClicks, parseCostPerLead } from "./normalize";
import { generateInsights } from "./insights-rules";
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
  let start = new Date(now);
  switch (preset) {
    case "today":
      start.setHours(0, 0, 0, 0);
      break;
    case "yesterday":
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      now.setDate(now.getDate() - 1);
      now.setHours(23, 59, 59, 999);
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
  return {
    since: start.toISOString().slice(0, 10),
    until: preset === "yesterday" ? now.toISOString().slice(0, 10) : now.toISOString().slice(0, 10),
  };
}

export async function fetchMetaAdsDashboard(
  accountId: string,
  range: DateRangePreset = "last_7d"
): Promise<MetaAdsDashboardData | MetaAdsDashboardError> {
  const token = process.env.META_ACCESS_TOKEN?.trim();
  const account = process.env.META_AD_ACCOUNT_ID?.trim() || accountId;

  if (!token) {
    return { ok: false, error: "META_ACCESS_TOKEN not configured", code: "NO_TOKEN" };
  }

  const acc = account.startsWith("act_") ? account : `act_${account}`;

  try {
    const [accountInsights, campaigns, adsets, ads] = await Promise.all([
      fetchAccountInsights(acc, range),
      fetchCampaignsWithInsights(acc, range),
      fetchAdSetsWithInsights(acc, range),
      fetchAdsWithInsights(acc, range),
    ]);

    const rawAccountInsight = Array.isArray(accountInsights?.data) && accountInsights.data.length > 0
      ? (accountInsights.data[0] as Record<string, unknown>)
      : {};

    const summary: MetaAdsSummary = {
      spend: parseFloat(String(rawAccountInsight.spend ?? 0)) || 0,
      impressions: parseInt(String(rawAccountInsight.impressions ?? 0), 10) || 0,
      reach: rawAccountInsight.reach != null ? parseInt(String(rawAccountInsight.reach), 10) : null,
      clicks: parseClicks(rawAccountInsight.actions as { action_type: string; value?: string }[], String(rawAccountInsight.clicks)),
      leads: parseLeads(rawAccountInsight.actions as { action_type: string; value?: string }[]),
      ctr: parseFloat(String(rawAccountInsight.ctr ?? 0)) || 0,
      cpc: parseFloat(String(rawAccountInsight.cpc ?? 0)) || 0,
      cpm: parseFloat(String(rawAccountInsight.cpm ?? 0)) || 0,
      frequency: rawAccountInsight.frequency != null ? parseFloat(String(rawAccountInsight.frequency)) : null,
      costPerLead: parseCostPerLead(rawAccountInsight.cost_per_action_type as { action_type: string; value?: string }[]),
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
        }
      )
    );

    if (summary.impressions === 0 && summary.spend === 0 && normCampaigns.length > 0) {
      const fallback = aggregateSummary(normCampaigns);
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
        }
      );
      return { ...row, campaignId: a.campaign_id ?? "" };
    });

    const normAds: MetaAdsAd[] = ads.map((a) => {
      const row = normalizeInsightToRow(
        (a.insight ?? {}) as Parameters<typeof normalizeInsightToRow>[0],
        {
          id: a.id,
          name: a.name,
          status: a.status,
          effective_status: a.effective_status,
          objective: undefined,
        }
      );
      return {
        ...row,
        adSetId: a.adset_id ?? "",
        creativeId: a.creative?.id ?? null,
        thumbnailUrl: a.thumbnailUrl ?? null,
      };
    });

    const insights = generateInsights(summary, normCampaigns, normAdsets, normAds);

    return {
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[meta-ads] fetch error:", msg);
    return { ok: false, error: msg.includes("token") ? "Invalid or expired token" : msg, code: "API_ERROR" };
  }
}
