import { describe, it, expect } from "vitest";
import { generateRecommendations } from "./recommendations-rules";
import type { MetaAdsSummary, MetaAdsCampaign, MetaAdsAdSet, MetaAdsAd } from "./types";

const baseSummary: MetaAdsSummary = {
  spend: 100,
  impressions: 5000,
  reach: 2000,
  clicks: 50,
  leads: 5,
  ctr: 1,
  cpc: 2,
  cpm: 20,
  frequency: 2,
  costPerLead: 20,
  spendDeltaPct: null,
  leadsDeltaPct: null,
  cplDeltaPct: null,
  ctrDeltaPct: null,
};

function mkCampaign(overrides: Partial<MetaAdsCampaign> = {}): MetaAdsCampaign {
  return {
    id: "c1",
    name: "Test Campaign",
    status: "ACTIVE",
    effectiveStatus: "ACTIVE",
    objective: "LEAD_GENERATION",
    spend: 30,
    impressions: 1000,
    reach: 500,
    clicks: 10,
    leads: 0,
    ctr: 1,
    cpc: 3,
    cpm: 30,
    frequency: 2,
    costPerLead: null,
    deliveryStatus: null,
    learningStatus: null,
    reviewStatus: null,
    ...overrides,
  };
}

function mkAdSet(overrides: Partial<MetaAdsAdSet> = {}): MetaAdsAdSet {
  return {
    ...mkCampaign(overrides),
    id: "as1",
    name: "Test Ad Set",
    campaignId: "c1",
    ...overrides,
  };
}

describe("generateRecommendations", () => {
  it("returns no_leads_after_spend when spend >= min and leads = 0", () => {
    const campaigns = [mkCampaign({ spend: 50, impressions: 200, leads: 0 })];
    const recs = generateRecommendations(baseSummary, campaigns, [], [], {
      minSpendForDecision: 20,
      minImpressionsForDecision: 100,
    });
    const noLeads = recs.filter((r) => r.ruleKey === "no_leads_after_spend");
    expect(noLeads.length).toBeGreaterThanOrEqual(1);
    expect(noLeads[0].actionType).toBe("pause");
    expect(noLeads[0].entityType).toBe("campaign");
  });

  it("returns learning_protection when in learning and allowChangesDuringLearning false", () => {
    const campaigns = [mkCampaign({ learningStatus: "LEARNING", spend: 30, impressions: 200, leads: 1 })];
    const recs = generateRecommendations(baseSummary, campaigns, [], [], {
      allowChangesDuringLearning: false,
    });
    const learning = recs.filter((r) => r.ruleKey === "learning_protection");
    expect(learning.length).toBeGreaterThanOrEqual(1);
    expect(learning[0].actionType).toBe("wait");
  });

  it("returns insufficient_data when spend below threshold", () => {
    const campaigns = [mkCampaign({ spend: 5, impressions: 50, leads: 0 })];
    const recs = generateRecommendations(baseSummary, campaigns, [], [], {
      minSpendForDecision: 20,
      minImpressionsForDecision: 100,
    });
    const insufficient = recs.filter((r) => r.ruleKey === "insufficient_data");
    expect(insufficient.length).toBeGreaterThanOrEqual(1);
    expect(insufficient[0].actionType).toBe("wait");
  });

  it("returns high_cpl when CPL > target * 2", () => {
    const campaigns = [mkCampaign({ spend: 100, leads: 2, costPerLead: 50 })];
    const recs = generateRecommendations(baseSummary, campaigns, [], [], {
      targetCpl: 20,
      minSpendForDecision: 20,
      minImpressionsForDecision: 100,
    });
    const highCpl = recs.filter((r) => r.ruleKey === "high_cpl");
    expect(highCpl.length).toBeGreaterThanOrEqual(1);
    expect(highCpl[0].actionType).toBe("decrease_budget");
  });

  it("returns winner_scale_candidate when CPL <= target and leads >= 2", () => {
    const campaigns = [mkCampaign({ spend: 40, leads: 4, costPerLead: 10, learningStatus: null })];
    const recs = generateRecommendations(baseSummary, campaigns, [], [], {
      targetCpl: 15,
      minSpendForDecision: 20,
      minImpressionsForDecision: 100,
      allowChangesDuringLearning: true,
    });
    const winner = recs.filter((r) => r.ruleKey === "winner_scale_candidate");
    expect(winner.length).toBeGreaterThanOrEqual(1);
    expect(winner[0].actionType).toBe("increase_budget");
  });

  it("skips protected campaigns", () => {
    const campaigns = [mkCampaign({ id: "protected1", spend: 50, leads: 0 })];
    const recs = generateRecommendations(baseSummary, campaigns, [], [], {
      minSpendForDecision: 20,
      minImpressionsForDecision: 100,
      protectedCampaignIds: ["protected1"],
    });
    const forProtected = recs.filter((r) => r.entityId === "protected1");
    expect(forProtected.length).toBe(0);
  });

  it("each recommendation has required fields", () => {
    const campaigns = [mkCampaign({ spend: 50, leads: 0 })];
    const recs = generateRecommendations(baseSummary, campaigns, [], []);
    for (const r of recs) {
      expect(r.ruleKey).toBeDefined();
      expect(r.reason).toBeDefined();
      expect(r.evidence).toBeDefined();
      expect(r.actionType).toBeDefined();
      expect(r.actionPayload).toBeDefined();
      expect(["info", "warn", "critical"]).toContain(r.severity);
      expect(["low", "medium", "high"]).toContain(r.confidence);
    }
  });
});
