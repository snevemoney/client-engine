/**
 * Phase 6.1: Today's Plan unit tests.
 */
import { describe, it, expect } from "vitest";
import { pickTopMoves } from "./today-plan";

describe("pickTopMoves", () => {
  it("prioritizes critical risk when present", () => {
    const result = pickTopMoves({
      score: { latest: { score: 72, band: "healthy", computedAt: new Date().toISOString() } },
      risk: {
        summary: { openBySeverity: { critical: 1, high: 2, medium: 0, low: 0 } },
        top: [
          { id: "r1", title: "Overdue reminder", severity: "critical", ruleKey: "reminder_overdue" },
        ],
      },
      nba: { top: [] },
    });

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].title).toContain("Address risk");
    expect(result[0].actionKey).toBe("run_risk_rules");
    expect(result[0].sources.length).toBeGreaterThanOrEqual(1);
    expect(result[0].sources[0].kind).toBe("risk_flag");
  });

  it("prioritizes score recovery when band is critical", () => {
    const result = pickTopMoves({
      score: {
        latest: {
          id: "s1",
          score: 35,
          band: "critical",
          computedAt: new Date().toISOString(),
        },
      },
      risk: { summary: { openBySeverity: {} }, top: [] },
      nba: { top: [] },
    });

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].title).toContain("Recompute");
    expect(result[0].actionKey).toBe("recompute_score");
    expect(result[0].sources.some((s) => s.kind === "score_snapshot")).toBe(true);
  });

  it("fills from NBA when no critical risk or score", () => {
    const result = pickTopMoves({
      score: { latest: { score: 75, band: "healthy", computedAt: new Date().toISOString() } },
      risk: { summary: { openBySeverity: {} }, top: [] },
      nba: {
        top: [
          {
            id: "a1",
            title: "Follow up on proposal",
            priority: "high",
            score: 85,
            reason: "Sent 3 days ago",
            ruleKey: "proposal_followup",
            dedupeKey: "pf:123",
          },
          {
            id: "a2",
            title: "Score new lead",
            priority: "medium",
            score: 70,
            reason: null,
            ruleKey: "score_lead",
            dedupeKey: "sl:456",
          },
        ],
      },
    });

    expect(result.length).toBe(2);
    expect(result[0].title).toBe("Follow up on proposal");
    expect(result[0].actionKey).toBe("nba_execute");
    expect(result[0].nextActionId).toBe("a1");
    expect(result[0].nbaActionKey).toBe("mark_done");
    expect(result[0].sources.some((s) => s.kind === "next_action")).toBe(true);
  });

  it("returns at most 3 moves", () => {
    const result = pickTopMoves({
      score: {
        latest: { score: 30, band: "critical", computedAt: new Date().toISOString() },
      },
      risk: {
        summary: { openBySeverity: { critical: 1 } },
        top: [{ id: "r1", title: "Risk", severity: "critical", ruleKey: "r" }],
      },
      nba: {
        top: [
          { id: "a1", title: "A1", priority: "high", score: 80, reason: null },
          { id: "a2", title: "A2", priority: "medium", score: 70, reason: null },
          { id: "a3", title: "A3", priority: "low", score: 60, reason: null },
        ],
      },
    });

    expect(result.length).toBeLessThanOrEqual(3);
  });

  it("every move has at least one source", () => {
    const result = pickTopMoves({
      score: { latest: { score: 75, band: "healthy", computedAt: new Date().toISOString() } },
      risk: { summary: { openBySeverity: {} }, top: [] },
      nba: {
        top: [
          { id: "a1", title: "Action", priority: "high", score: 80, reason: "Why" },
        ],
      },
    });

    for (const move of result) {
      expect(move.sources.length).toBeGreaterThanOrEqual(1);
    }
  });
});
