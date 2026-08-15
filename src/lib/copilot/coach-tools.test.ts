/**
 * Phase 5.1: Coach tools unit tests.
 * Phase 2: Mocks domain services (no HTTP).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getScoreContext,
  getRiskContext,
  getNBAContext,
  runRecomputeScore,
  runRiskRules,
  runNextActions,
} from "./coach-tools";

vi.mock("@/lib/services/score-service", () => ({
  getScoreContext: vi.fn(),
  compute: vi.fn(),
}));
vi.mock("@/lib/services/risk-service", () => ({
  getSummary: vi.fn(),
  list: vi.fn(),
  runRules: vi.fn(),
}));
vi.mock("@/lib/services/nba-service", () => ({
  getSummary: vi.fn(),
  list: vi.fn(),
  runRules: vi.fn(),
}));

import * as scoreService from "@/lib/services/score-service";
import * as riskService from "@/lib/services/risk-service";
import * as nbaService from "@/lib/services/nba-service";

describe("coach-tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getScoreContext returns latest and recentEvents on success", async () => {
    vi.mocked(scoreService.getScoreContext).mockResolvedValue({
      latest: { score: 72, band: "healthy", computedAt: "2024-06-15T12:00:00Z" },
      recentEvents: [{ eventType: "threshold_breach", createdAt: "2024-06-14T10:00:00Z" }],
    });

    const result = await getScoreContext("command_center", "command_center");

    expect(result.error).toBeUndefined();
    expect(result.latest).toEqual({ score: 72, band: "healthy", computedAt: "2024-06-15T12:00:00Z" });
    expect(result.recentEvents).toHaveLength(1);
  });

  it("getScoreContext returns error when service throws", async () => {
    vi.mocked(scoreService.getScoreContext).mockRejectedValue(new Error("Unauthorized"));

    const result = await getScoreContext("command_center", "command_center");

    expect(result.error).toBe("Unauthorized");
    expect(result.latest).toBeNull();
    expect(result.recentEvents).toEqual([]);
  });

  it("getRiskContext returns summary and top on success", async () => {
    vi.mocked(riskService.getSummary).mockResolvedValue({
      openBySeverity: { low: 0, medium: 0, high: 2, critical: 1 },
      snoozedCount: 0,
      lastRunAt: "2024-06-15T10:00:00Z",
    });
    vi.mocked(riskService.list).mockResolvedValue({
      items: [{ id: "r1", title: "Risk 1", severity: "critical", status: "open", createdByRule: "rule1" } as never],
      total: 1,
    });

    const result = await getRiskContext();

    expect(result.error).toBeUndefined();
    expect(result.summary.openBySeverity.critical).toBe(1);
    expect(result.top).toHaveLength(1);
    expect(result.top[0]!.title).toBe("Risk 1");
  });

  it("getNBAContext returns summary and top on success", async () => {
    vi.mocked(nbaService.getSummary).mockResolvedValue({
      top5: [{ id: "a1", title: "Action 1", priority: "high", score: 80 } as never],
      queuedByPriority: { low: 0, medium: 0, high: 1, critical: 0 },
      lastRunAt: "2024-06-15T09:00:00Z",
      entityType: "command_center",
      entityId: "command_center",
    });
    vi.mocked(nbaService.list).mockResolvedValue({
      items: [{ id: "a1", title: "Action 1", priority: "high", score: 80, reason: "Because", createdByRule: null, dedupeKey: null } as never],
      total: 1,
    });

    const result = await getNBAContext("command_center", "command_center");

    expect(result.error).toBeUndefined();
    expect(result.summary.top5).toHaveLength(1);
    expect(result.top).toHaveLength(1);
    expect(result.top[0]!.reason).toBe("Because");
  });

  it("runRecomputeScore returns ok on success", async () => {
    vi.mocked(scoreService.compute).mockResolvedValue({
      snapshotId: "s1",
      score: 75,
      band: "healthy",
      delta: 2,
      eventsCreated: [],
    });

    const result = await runRecomputeScore("command_center", "command_center");

    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();
  });

  it("runRecomputeScore returns error on failure", async () => {
    vi.mocked(scoreService.compute).mockRejectedValue(new Error("Compute failed"));

    const result = await runRecomputeScore("command_center", "command_center");

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Compute failed");
  });

  it("runRiskRules returns ok on success", async () => {
    vi.mocked(riskService.runRules).mockResolvedValue({
      created: 2,
      updated: 0,
      criticalNotified: 0,
      lastRunAt: "2024-06-15T10:00:00Z",
    });

    const result = await runRiskRules();

    expect(result.ok).toBe(true);
  });

  it("runNextActions returns ok on success", async () => {
    vi.mocked(nbaService.runRules).mockResolvedValue({
      created: 1,
      updated: 0,
      runKey: "nba:test:command_center:command_center:2024-06-15",
      lastRunAt: "2024-06-15T10:00:00Z",
    });

    const result = await runNextActions("command_center", "command_center");

    expect(result.ok).toBe(true);
  });
});
