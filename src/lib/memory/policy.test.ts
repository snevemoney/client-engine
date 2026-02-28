/**
 * Phase 7.2: Policy engine unit tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  computeWindowStats,
  computeTrendDiffs,
  derivePolicySuggestions,
  buildPatternAlerts,
  type WindowStats,
} from "./policy";

vi.mock("@/lib/db", () => ({
  db: {
    operatorMemoryEvent: {
      findMany: vi.fn(),
    },
  },
}));

describe("policy engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("computeTrendDiffs", () => {
    it("emits top deltas by absolute change", () => {
      const current: WindowStats = {
        byRuleKey: {
          r1: { executeSuccess: 2, executeFailure: 0, dismiss: 0, snooze: 0, total: 2, dismissRate: 0, successRate: 1 },
          r2: { executeSuccess: 0, executeFailure: 0, dismiss: 5, snooze: 0, total: 5, dismissRate: 1, successRate: 0 },
          r3: { executeSuccess: 1, executeFailure: 0, dismiss: 0, snooze: 0, total: 1, dismissRate: 0, successRate: 1 },
        },
      };
      const prior: WindowStats = {
        byRuleKey: {
          r1: { executeSuccess: 5, executeFailure: 0, dismiss: 0, snooze: 0, total: 5, dismissRate: 0, successRate: 1 },
          r2: { executeSuccess: 0, executeFailure: 0, dismiss: 1, snooze: 0, total: 1, dismissRate: 1, successRate: 0 },
          r3: { executeSuccess: 0, executeFailure: 0, dismiss: 0, snooze: 0, total: 0, dismissRate: 0, successRate: 0 },
        },
      };

      const diffs = computeTrendDiffs(current, prior);

      expect(diffs.recurring.length).toBeGreaterThan(0);
      expect(diffs.recurring[0]).toMatchObject({
        ruleKey: expect.any(String),
        currentCount: expect.any(Number),
        priorCount: expect.any(Number),
        delta: expect.any(Number),
        direction: expect.stringMatching(/^(up|down|unchanged)$/),
      });
      expect(diffs.dismissed.some((d) => d.ruleKey === "r2")).toBe(true);
      expect(diffs.successful.some((d) => d.ruleKey === "r1" || d.ruleKey === "r3")).toBe(true);
    });
  });

  describe("derivePolicySuggestions", () => {
    it("suggests suppression_30d when dismissCount >= 3 and successRate <= 0.25", () => {
      const stats: WindowStats = {
        byRuleKey: {
          noisy_rule: {
            executeSuccess: 0,
            executeFailure: 1,
            dismiss: 4,
            snooze: 0,
            total: 5,
            dismissRate: 0.8,
            successRate: 0,
          },
        },
      };
      const diffs = {
        recurring: [
          { ruleKey: "noisy_rule", currentCount: 5, priorCount: 2, delta: 3, direction: "up" as const },
        ],
        dismissed: [
          { ruleKey: "noisy_rule", currentCount: 5, priorCount: 2, delta: 3, direction: "up" as const },
        ],
        successful: [],
      };

      const suggestions = derivePolicySuggestions(stats, diffs);

      const suppression = suggestions.find((s) => s.type === "suppression_30d" && s.ruleKey === "noisy_rule");
      expect(suppression).toBeDefined();
      expect(suppression!.confidence).toBeGreaterThan(0);
      expect(suppression!.reasons.length).toBeGreaterThan(0);
    });

    it("suggests raise_risk when failureCount >= 2", () => {
      const stats: WindowStats = {
        byRuleKey: {
          failing_rule: {
            executeSuccess: 0,
            executeFailure: 3,
            dismiss: 0,
            snooze: 0,
            total: 3,
            dismissRate: 0,
            successRate: 0,
          },
        },
      };
      const diffs = {
        recurring: [
          { ruleKey: "failing_rule", currentCount: 3, priorCount: 0, delta: 3, direction: "up" as const },
        ],
        dismissed: [],
        successful: [],
      };

      const suggestions = derivePolicySuggestions(stats, diffs);

      const raiseRisk = suggestions.find((s) => s.type === "raise_risk" && s.ruleKey === "failing_rule");
      expect(raiseRisk).toBeDefined();
      expect(raiseRisk!.severity).toBeDefined();
    });

    it("suggests raise_risk when delta >= 3 vs prior", () => {
      const stats: WindowStats = {
        byRuleKey: {
          spiking_rule: {
            executeSuccess: 5,
            executeFailure: 0,
            dismiss: 0,
            snooze: 0,
            total: 5,
            dismissRate: 0,
            successRate: 1,
          },
        },
      };
      const diffs = {
        recurring: [
          { ruleKey: "spiking_rule", currentCount: 5, priorCount: 1, delta: 4, direction: "up" as const },
        ],
        dismissed: [],
        successful: [
          { ruleKey: "spiking_rule", currentCount: 5, priorCount: 1, delta: 4, direction: "up" as const },
        ],
      };

      const suggestions = derivePolicySuggestions(stats, diffs);

      const raiseRisk = suggestions.find((s) => s.type === "raise_risk" && s.ruleKey === "spiking_rule");
      expect(raiseRisk).toBeDefined();
    });
  });

  describe("buildPatternAlerts", () => {
    it("builds alerts from raise_risk suggestions with dedupeKey", () => {
      const suggestions = [
        {
          type: "raise_risk" as const,
          ruleKey: "r1",
          confidence: 0.5,
          reasons: ["2 failures"],
          evidence: [{ key: "failureCount", value: 2 }],
          severity: "medium" as const,
        },
      ];

      const alerts = buildPatternAlerts(suggestions);

      expect(alerts.length).toBe(1);
      expect(alerts[0]).toMatchObject({
        ruleKey: "r1",
        severity: "medium",
        title: "Pattern alert: r1",
        description: "2 failures",
      });
      expect(alerts[0].dedupeKey).toMatch(/^pattern:r1:\d{4}-\d{2}-\d{2}$/);
    });

    it("dedupes by ruleKey", () => {
      const suggestions = [
        {
          type: "raise_risk" as const,
          ruleKey: "r1",
          confidence: 0.5,
          reasons: ["a"],
          evidence: [],
          severity: "medium" as const,
        },
        {
          type: "raise_risk" as const,
          ruleKey: "r1",
          confidence: 0.8,
          reasons: ["b"],
          evidence: [],
          severity: "high" as const,
        },
      ];

      const alerts = buildPatternAlerts(suggestions);

      expect(alerts.length).toBe(1);
    });
  });
});
