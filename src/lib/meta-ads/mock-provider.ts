/**
 * Mock Meta Ads provider — local simulation without Meta API.
 * Used when META_MODE=mock. Multiple scenarios via META_MOCK_SCENARIO.
 */

import { generateInsights } from "./insights-rules";
import { getMetaMockScenario } from "./mode";
import type {
  MetaAdsDashboardData,
  MetaAdsSummary,
  MetaAdsCampaign,
  MetaAdsAdSet,
  MetaAdsAd,
  DateRangePreset,
  OperatorInsight,
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

function mkCampaign(
  overrides: Partial<MetaAdsCampaign> & { id: string; name: string }
): MetaAdsCampaign {
  return {
    id: overrides.id,
    name: overrides.name,
    status: overrides.status ?? "ACTIVE",
    effectiveStatus: overrides.effectiveStatus ?? "ACTIVE",
    objective: overrides.objective ?? "LEAD_GENERATION",
    spend: overrides.spend ?? 0,
    impressions: overrides.impressions ?? 0,
    reach: overrides.reach ?? null,
    clicks: overrides.clicks ?? 0,
    leads: overrides.leads ?? 0,
    ctr: overrides.ctr ?? 0,
    cpc: overrides.cpc ?? 0,
    cpm: overrides.cpm ?? 0,
    frequency: overrides.frequency ?? null,
    costPerLead: overrides.costPerLead ?? null,
    deliveryStatus: overrides.deliveryStatus ?? null,
    learningStatus: overrides.learningStatus ?? null,
    reviewStatus: overrides.reviewStatus ?? null,
    spendDeltaPct: overrides.spendDeltaPct ?? null,
    leadsDeltaPct: overrides.leadsDeltaPct ?? null,
    cplDeltaPct: overrides.cplDeltaPct ?? null,
    ctrDeltaPct: overrides.ctrDeltaPct ?? null,
    frequencyDeltaPct: overrides.frequencyDeltaPct ?? null,
  };
}

function mkAdSet(
  campaignId: string,
  overrides: Partial<MetaAdsAdSet> & { id: string; name: string }
): MetaAdsAdSet {
  return { ...mkCampaign(overrides), campaignId };
}

function mkAd(
  adSetId: string,
  campaignId: string,
  overrides: Partial<MetaAdsAd> & { id: string; name: string }
): MetaAdsAd {
  return {
    ...mkCampaign(overrides),
    adSetId,
    campaignId,
    creativeId: null,
    thumbnailUrl: null,
  };
}

function buildData(
  accountId: string,
  range: DateRangePreset,
  summary: MetaAdsSummary,
  campaigns: MetaAdsCampaign[],
  adsets: MetaAdsAdSet[],
  ads: MetaAdsAd[]
): MetaAdsDashboardData {
  const { since, until } = toDateRange(range);
  const insights: OperatorInsight[] = generateInsights(summary, campaigns, adsets, ads, null);

  return {
    ok: true,
    accountId,
    range: { since, until },
    datePreset: range,
    lastFetchedAt: new Date().toISOString(),
    summary,
    campaigns,
    adsets,
    ads,
    insights,
  };
}

/** Mock dashboard data by scenario */
export function getMockDashboardData(
  accountId: string,
  range: DateRangePreset
): MetaAdsDashboardData {
  const acc = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  const scenario = getMetaMockScenario();

  if (scenario === "no_campaigns") {
    return buildData(
      acc,
      range,
      {
        spend: 0,
        impressions: 0,
        reach: null,
        clicks: 0,
        leads: 0,
        ctr: 0,
        cpc: 0,
        cpm: 0,
        frequency: null,
        costPerLead: null,
        spendDeltaPct: null,
        leadsDeltaPct: null,
        cplDeltaPct: null,
        ctrDeltaPct: null,
        cpcDeltaPct: null,
        cpmDeltaPct: null,
        frequencyDeltaPct: null,
      },
      [],
      [],
      []
    );
  }

  if (scenario === "healthy_campaigns") {
    const c1 = mkCampaign({
      id: "mc_healthy_1",
      name: "Lead Gen - Main",
      spend: 120,
      impressions: 5000,
      leads: 8,
      costPerLead: 15,
      ctr: 2.1,
      cplDeltaPct: -10,
    });
    const c2 = mkCampaign({
      id: "mc_healthy_2",
      name: "Retargeting - Warm",
      spend: 45,
      impressions: 2000,
      leads: 4,
      costPerLead: 11,
      ctr: 1.8,
    });
    const as1 = mkAdSet(c1.id, {
      id: "mas_healthy_1",
      name: "US 25-54",
      spend: 80,
      impressions: 3500,
      leads: 5,
      costPerLead: 16,
      campaignId: c1.id,
    });
    const as2 = mkAdSet(c1.id, {
      id: "mas_healthy_2",
      name: "CA 25-54",
      spend: 40,
      impressions: 1500,
      leads: 3,
      costPerLead: 13,
      campaignId: c1.id,
    });
    const ad1 = mkAd(as1.id, c1.id, {
      id: "mad_healthy_1",
      name: "Ad A - Headline 1",
      spend: 50,
      impressions: 2000,
      leads: 3,
      costPerLead: 17,
      adSetId: as1.id,
      campaignId: c1.id,
    });

    const summary: MetaAdsSummary = {
      spend: 165,
      impressions: 7000,
      reach: 4200,
      clicks: 147,
      leads: 12,
      ctr: 2.1,
      cpc: 1.12,
      cpm: 23.6,
      frequency: 1.67,
      costPerLead: 13.75,
      spendDeltaPct: 5,
      leadsDeltaPct: 20,
      cplDeltaPct: -8,
      ctrDeltaPct: 2,
      cpcDeltaPct: null,
      cpmDeltaPct: null,
      frequencyDeltaPct: null,
    };

    return buildData(acc, range, summary, [c1, c2], [as1, as2], [ad1]);
  }

  if (scenario === "high_cpl") {
    const c1 = mkCampaign({
      id: "mc_highcpl_1",
      name: "Lead Gen - Expensive",
      spend: 200,
      impressions: 3000,
      leads: 2,
      costPerLead: 100,
      ctr: 0.8,
      cplDeltaPct: 45,
    });
    return buildData(
      acc,
      range,
      {
        spend: 200,
        impressions: 3000,
        reach: 1800,
        clicks: 24,
        leads: 2,
        ctr: 0.8,
        cpc: 8.33,
        cpm: 66.67,
        frequency: 1.67,
        costPerLead: 100,
        spendDeltaPct: 15,
        leadsDeltaPct: -50,
        cplDeltaPct: 45,
        ctrDeltaPct: -10,
        cpcDeltaPct: null,
        cpmDeltaPct: null,
        frequencyDeltaPct: null,
      },
      [c1],
      [
        mkAdSet(c1.id, {
          id: "mas_highcpl_1",
          name: "US Broad",
          spend: 200,
          impressions: 3000,
          leads: 2,
          costPerLead: 100,
          campaignId: c1.id,
        }),
      ],
      []
    );
  }

  if (scenario === "no_leads_after_spend") {
    const c1 = mkCampaign({
      id: "mc_noleads_1",
      name: "Lead Gen - Zero Leads",
      spend: 85,
      impressions: 4000,
      leads: 0,
      costPerLead: null,
      ctr: 1.2,
      effectiveStatus: "ACTIVE",
    });
    return buildData(
      acc,
      range,
      {
        spend: 85,
        impressions: 4000,
        reach: 2400,
        clicks: 48,
        leads: 0,
        ctr: 1.2,
        cpc: 1.77,
        cpm: 21.25,
        frequency: 1.67,
        costPerLead: null,
        spendDeltaPct: null,
        leadsDeltaPct: null,
        cplDeltaPct: null,
        ctrDeltaPct: null,
        cpcDeltaPct: null,
        cpmDeltaPct: null,
        frequencyDeltaPct: null,
      },
      [c1],
      [mkAdSet(c1.id, { id: "mas_noleads_1", name: "US 25+", spend: 85, impressions: 4000, leads: 0, campaignId: c1.id })],
      []
    );
  }

  if (scenario === "fatigue_detected") {
    const c1 = mkCampaign({
      id: "mc_fatigue_1",
      name: "Lead Gen - Fatigued",
      spend: 150,
      impressions: 8000,
      leads: 6,
      costPerLead: 25,
      ctr: 0.9,
      frequency: 4.2,
      effectiveStatus: "ACTIVE",
    });
    return buildData(
      acc,
      range,
      {
        spend: 150,
        impressions: 8000,
        reach: 1900,
        clicks: 72,
        leads: 6,
        ctr: 0.9,
        cpc: 2.08,
        cpm: 18.75,
        frequency: 4.2,
        costPerLead: 25,
        spendDeltaPct: null,
        leadsDeltaPct: null,
        cplDeltaPct: null,
        ctrDeltaPct: null,
        cpcDeltaPct: null,
        cpmDeltaPct: null,
        frequencyDeltaPct: null,
      },
      [c1],
      [mkAdSet(c1.id, { id: "mas_fatigue_1", name: "US Narrow", spend: 150, impressions: 8000, leads: 6, frequency: 4.2, campaignId: c1.id })],
      []
    );
  }

  if (scenario === "mixed_account") {
    const c1 = mkCampaign({
      id: "mc_mixed_1",
      name: "Lead Gen - Good",
      spend: 90,
      impressions: 4500,
      leads: 9,
      costPerLead: 10,
      ctr: 2.2,
    });
    const c2 = mkCampaign({
      id: "mc_mixed_2",
      name: "Lead Gen - Bad",
      spend: 110,
      impressions: 3500,
      leads: 0,
      costPerLead: null,
      ctr: 0.7,
      effectiveStatus: "ACTIVE",
    });
    const c3 = mkCampaign({
      id: "mc_mixed_3",
      name: "Lead Gen - High CPL",
      spend: 60,
      impressions: 2000,
      leads: 2,
      costPerLead: 30,
      ctr: 1.5,
      cplDeltaPct: 60,
    });
    return buildData(
      acc,
      range,
      {
        spend: 260,
        impressions: 10000,
        reach: 6000,
        clicks: 150,
        leads: 11,
        ctr: 1.5,
        cpc: 1.73,
        cpm: 26,
        frequency: 1.67,
        costPerLead: 23.64,
        spendDeltaPct: 10,
        leadsDeltaPct: -15,
        cplDeltaPct: 20,
        ctrDeltaPct: null,
        cpcDeltaPct: null,
        cpmDeltaPct: null,
        frequencyDeltaPct: null,
      },
      [c1, c2, c3],
      [
        mkAdSet(c1.id, { id: "mas_mixed_1", name: "US", spend: 90, impressions: 4500, leads: 9, campaignId: c1.id }),
        mkAdSet(c2.id, { id: "mas_mixed_2", name: "CA", spend: 110, impressions: 3500, leads: 0, campaignId: c2.id }),
      ],
      []
    );
  }

  // Fallback to healthy
  // Fallback to healthy_campaigns
  const c1 = mkCampaign({
    id: "mc_healthy_1",
    name: "Lead Gen - Main",
    spend: 120,
    impressions: 5000,
    leads: 8,
    costPerLead: 15,
    ctr: 2.1,
  });
  const as1 = mkAdSet(c1.id, { id: "mas_healthy_1", name: "US 25-54", spend: 80, impressions: 3500, leads: 5, campaignId: c1.id });
  const summary: MetaAdsSummary = {
    spend: 120, impressions: 5000, reach: 3000, clicks: 105, leads: 8, ctr: 2.1, cpc: 1.14, cpm: 24,
    frequency: 1.67, costPerLead: 15,
    spendDeltaPct: null, leadsDeltaPct: null, cplDeltaPct: null, ctrDeltaPct: null, cpcDeltaPct: null, cpmDeltaPct: null, frequencyDeltaPct: null,
  };
  return buildData(acc, range, summary, [c1], [as1], []);
}
