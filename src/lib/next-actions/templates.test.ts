/**
 * Phase 4.4: NBA templates unit tests.
 */
import { describe, it, expect } from "vitest";
import { getTemplate, listTemplateRuleKeys } from "./templates";

describe("templates", () => {
  it("getTemplate returns template for known ruleKey", () => {
    const t = getTemplate("score_in_critical_band");
    expect(t.ruleKey).toBe("score_in_critical_band");
    expect(t.title).toBe("Investigate top score reasons");
    expect(t.outcome).toBeDefined();
    expect(t.why).toBeDefined();
    expect(t.checklist.length).toBeGreaterThan(0);
    expect(t.suggestedActions).toBeDefined();
    expect(t.suggestedActions!.length).toBeGreaterThan(0);
  });

  it("getTemplate returns default for unknown ruleKey", () => {
    const t = getTemplate("unknown_rule_xyz");
    expect(t.ruleKey).toBe("unknown_rule_xyz");
    expect(t.title).toBe("Complete this action");
    expect(t.checklist.length).toBeGreaterThan(0);
  });

  it("getTemplate returns default for null/undefined", () => {
    expect(getTemplate(null).ruleKey).toBe("default");
    expect(getTemplate(undefined).ruleKey).toBe("default");
  });

  it("listTemplateRuleKeys returns all registered keys", () => {
    const keys = listTemplateRuleKeys();
    expect(keys).toContain("score_in_critical_band");
    expect(keys).toContain("flywheel_won_no_delivery");
    expect(keys.length).toBeGreaterThan(5);
  });

  it("templates have valid suggestedActions actionKeys", () => {
    const validActionKeys = ["mark_done", "snooze_1d", "dismiss", "don_t_suggest_again_30d", "recompute_score", "run_risk_rules", "run_next_actions", "retry_failed_deliveries"];
    const keys = listTemplateRuleKeys();
    for (const ruleKey of keys) {
      const t = getTemplate(ruleKey);
      for (const sa of t.suggestedActions ?? []) {
        expect(validActionKeys).toContain(sa.actionKey);
      }
    }
  });
});
