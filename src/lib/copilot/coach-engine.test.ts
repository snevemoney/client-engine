/**
 * Phase 5.1: Coach engine unit tests.
 */
import { describe, it, expect } from "vitest";
import { deriveCoachResponse, type CoachContexts } from "./coach-engine";

describe("coach-engine", () => {
  it("returns data_unavailable when all contexts fail", () => {
    const contexts: CoachContexts = {
      score: { latest: null, recentEvents: [], error: "Unauthorized" },
      risk: { summary: { openBySeverity: {}, lastRunAt: null }, top: [], error: "Failed" },
      nba: { summary: { top5: [], queuedByPriority: {}, lastRunAt: null }, top: [], error: "Failed" },
    };

    const result = deriveCoachResponse("what should I do?", contexts);

    expect(result.reply.status).toBe("data_unavailable");
    expect(result.reply.diagnosis).toContain("can't confirm");
    expect(result.reply.topActions.length).toBeGreaterThan(0);
    expect(result.reply.risksOrUnknowns.length).toBeGreaterThan(0);
    expect(result.reply.suggestedCommands.length).toBeGreaterThan(0);
  });

  it("prioritizes score recovery when band is critical", () => {
    const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const contexts: CoachContexts = {
      score: {
        latest: { score: 35, band: "critical", computedAt: recent },
        recentEvents: [],
      },
      risk: { summary: { openBySeverity: { critical: 0, high: 0 }, lastRunAt: null }, top: [] },
      nba: { summary: { top5: [], queuedByPriority: {}, lastRunAt: null }, top: [] },
    };

    const result = deriveCoachResponse("what should I do?", contexts);

    expect(result.reply.status).toContain("critical");
    expect(result.reply.topActions.length).toBeGreaterThan(0);
    expect(result.reply.topActions[0].actionKey).toBe("run_recompute_score");
    expect(result.reply.topActions[0].evidence).toContain("Score: 35");
  });

  it("prioritizes risk remediation when critical risks exist", () => {
    const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const contexts: CoachContexts = {
      score: {
        latest: { score: 72, band: "healthy", computedAt: recent },
        recentEvents: [],
      },
      risk: {
        summary: { openBySeverity: { critical: 1, high: 2 }, lastRunAt: "2024-06-15T10:00:00Z" },
        top: [{ id: "r1", title: "Overdue reminder", severity: "critical", status: "open" }],
      },
      nba: { summary: { top5: [], queuedByPriority: {}, lastRunAt: null }, top: [] },
    };

    const result = deriveCoachResponse("what should I do?", contexts);

    expect(result.reply.status).toContain("risk");
    const riskAction = result.reply.topActions.find((a) => a.actionKey === "view_risk");
    expect(riskAction).toBeDefined();
    expect(riskAction?.evidence).toContain("Risk ID: r1");
  });

  it("picks top 3 NBA actions with evidence", () => {
    const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const contexts: CoachContexts = {
      score: {
        latest: { score: 75, band: "healthy", computedAt: recent },
        recentEvents: [],
      },
      risk: { summary: { openBySeverity: {}, lastRunAt: null }, top: [] },
      nba: {
        summary: {
          top5: [
            { id: "a1", title: "Follow up on proposal", priority: "high", score: 85 },
            { id: "a2", title: "Score new lead", priority: "medium", score: 70 },
          ],
          queuedByPriority: { high: 1, medium: 1 },
          lastRunAt: "2024-06-15T09:00:00Z",
        },
        top: [
          { id: "a1", title: "Follow up on proposal", priority: "high", score: 85, reason: "Sent 3 days ago" },
          { id: "a2", title: "Score new lead", priority: "medium", score: 70, reason: null },
        ],
      },
    };

    const result = deriveCoachResponse("what should I do today?", contexts);

    expect(result.reply.topActions.length).toBe(2);
    expect(result.reply.topActions[0].title).toBe("Follow up on proposal");
    expect(result.reply.topActions[0].evidence).toContain("NBA ID: a1");
    expect(result.reply.topActions[1].title).toBe("Score new lead");
  });

  it("refuses when score is stale and user asks what to do today", () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const contexts: CoachContexts = {
      score: {
        latest: { score: 75, band: "healthy", computedAt: old },
        recentEvents: [],
      },
      risk: { summary: { openBySeverity: {}, lastRunAt: null }, top: [] },
      nba: { summary: { top5: [], queuedByPriority: {}, lastRunAt: null }, top: [] },
    };

    const result = deriveCoachResponse("what should I do today?", contexts);

    expect(result.reply.status).toBe("refused");
    expect(result.reply.diagnosis).toMatch(/stale|outdated|24/);
  });

  it("top actions include sources for citations", () => {
    const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const contexts: CoachContexts = {
      score: {
        latest: { score: 35, band: "critical", computedAt: recent },
        recentEvents: [],
      },
      risk: { summary: { openBySeverity: {}, lastRunAt: null }, top: [] },
      nba: { summary: { top5: [], queuedByPriority: {}, lastRunAt: null }, top: [] },
    };

    const result = deriveCoachResponse("what should I do?", contexts);

    expect(result.reply.topActions.length).toBeGreaterThan(0);
    expect(result.reply.topActions[0].sources).toBeDefined();
    expect(result.reply.topActions[0].sources!.length).toBeGreaterThanOrEqual(1);
  });

  it("sources include formatted strings", () => {
    const contexts: CoachContexts = {
      score: {
        latest: { score: 80, band: "healthy", computedAt: "2024-06-15T12:00:00Z" },
        recentEvents: [{ eventType: "recovery", createdAt: "2024-06-14T10:00:00Z" }],
      },
      risk: { summary: { openBySeverity: { low: 1 }, lastRunAt: null }, top: [] },
      nba: { summary: { top5: [], queuedByPriority: {}, lastRunAt: null }, top: [] },
    };

    const result = deriveCoachResponse("status?", contexts);

    expect(result.sources.score.latest).toContain("80");
    expect(result.sources.score.recentEvents).toHaveLength(1);
    expect(result.sources.risk.summary).toContain("1 open");
  });
});
