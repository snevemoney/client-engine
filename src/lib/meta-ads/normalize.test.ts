import { describe, it, expect } from "vitest";
import { normalizeInsightToRow, parseRawToPriorMetrics } from "./normalize";

describe("normalize", () => {
  describe("parseRawToPriorMetrics", () => {
    it("parses raw insight to prior metrics", () => {
      const raw = {
        spend: "50",
        impressions: "1000",
        actions: [{ action_type: "lead", value: "3" }],
        ctr: "1.5",
        frequency: "2.1",
      };
      const prior = parseRawToPriorMetrics(raw as Parameters<typeof parseRawToPriorMetrics>[0]);
      expect(prior.spend).toBe(50);
      expect(prior.leads).toBe(3);
      expect(prior.ctr).toBe(1.5);
      expect(prior.costPerLead).toBeCloseTo(50 / 3);
      expect(prior.frequency).toBe(2.1);
    });

    it("handles missing prior data", () => {
      const raw = {};
      const prior = parseRawToPriorMetrics(raw as Parameters<typeof parseRawToPriorMetrics>[0]);
      expect(prior.spend).toBe(0);
      expect(prior.leads).toBe(0);
    });
  });

  describe("normalizeInsightToRow with prior", () => {
    it("adds trend deltas when prior provided", () => {
      const raw = { spend: "100", impressions: "1000", reach: "500", ctr: "2", cpc: "1", cpm: "10", frequency: "2", actions: [{ action_type: "lead", value: "5" }] };
      const prior = { spend: 80, leads: 4, ctr: 1.5, costPerLead: 20, frequency: 1.5 };
      const row = normalizeInsightToRow(
        raw as Parameters<typeof normalizeInsightToRow>[0],
        { id: "c1", name: "Test" },
        prior
      );
      expect(row.spendDeltaPct).toBe(25); // (100-80)/80
      expect(row.leadsDeltaPct).toBe(25); // (5-4)/4
      expect(row.ctrDeltaPct).toBeCloseTo(33.33, 0); // (2-1.5)/1.5
      expect(row.cplDeltaPct).toBe(0); // 20 vs 20
      expect(row.frequencyDeltaPct).toBeCloseTo(33.33, 0);
    });

    it("returns null deltas when prior not provided", () => {
      const raw = { spend: "50", impressions: "500", ctr: "1", actions: [] };
      const row = normalizeInsightToRow(
        raw as Parameters<typeof normalizeInsightToRow>[0],
        { id: "c1", name: "Test" }
      );
      expect(row.spendDeltaPct).toBeUndefined();
      expect(row.cplDeltaPct).toBeUndefined();
    });
  });
});
