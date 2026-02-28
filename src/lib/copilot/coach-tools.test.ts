/**
 * Phase 5.1: Coach tools unit tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getScoreContext,
  getRiskContext,
  getNBAContext,
  runRecomputeScore,
  runRiskRules,
  runNextActions,
  type CoachFetchOptions,
} from "./coach-tools";

const opts: CoachFetchOptions = { baseUrl: "http://localhost:3000", cookie: "session=test" };

describe("coach-tools", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
  });

  it("getScoreContext returns latest and recentEvents on success", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              latest: { score: 72, band: "healthy", computedAt: "2024-06-15T12:00:00Z" },
              recentEvents: [{ eventType: "threshold_breach", createdAt: "2024-06-14T10:00:00Z" }],
            })
          ),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              events: [{ eventType: "recovery", createdAt: "2024-06-15T11:00:00Z" }],
            })
          ),
      });

    const result = await getScoreContext("command_center", "command_center", opts, mockFetch);

    expect(result.error).toBeUndefined();
    expect(result.latest).toEqual({ score: 72, band: "healthy", computedAt: "2024-06-15T12:00:00Z" });
    expect(result.recentEvents.length).toBeGreaterThanOrEqual(1);
  });

  it("getScoreContext returns error when summary fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, text: () => Promise.resolve(JSON.stringify({ error: "Unauthorized" })) });

    const result = await getScoreContext("command_center", "command_center", opts, mockFetch);

    expect(result.error).toBe("Unauthorized");
    expect(result.latest).toBeNull();
    expect(result.recentEvents).toEqual([]);
  });

  it("getRiskContext returns summary and top on success", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              openBySeverity: { critical: 1, high: 2 },
              lastRunAt: "2024-06-15T10:00:00Z",
            })
          ),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              items: [{ id: "r1", title: "Risk 1", severity: "critical", status: "open" }],
            })
          ),
      });

    const result = await getRiskContext("command_center", "command_center", opts, mockFetch);

    expect(result.error).toBeUndefined();
    expect(result.summary.openBySeverity.critical).toBe(1);
    expect(result.top).toHaveLength(1);
    expect(result.top[0].title).toBe("Risk 1");
  });

  it("getNBAContext returns summary and top on success", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              top5: [{ id: "a1", title: "Action 1", priority: "high", score: 80 }],
              queuedByPriority: { high: 1 },
              lastRunAt: "2024-06-15T09:00:00Z",
            })
          ),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              items: [{ id: "a1", title: "Action 1", priority: "high", score: 80, reason: "Because" }],
            })
          ),
      });

    const result = await getNBAContext("command_center", "command_center", opts, mockFetch);

    expect(result.error).toBeUndefined();
    expect(result.summary.top5).toHaveLength(1);
    expect(result.top).toHaveLength(1);
    expect(result.top[0].reason).toBe("Because");
  });

  it("runRecomputeScore returns ok on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ snapshotId: "s1", score: 75, band: "healthy" })),
    });

    const result = await runRecomputeScore("command_center", "command_center", opts, mockFetch);

    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();
  });

  it("runRecomputeScore returns error on failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: () => Promise.resolve(JSON.stringify({ error: "Compute failed" })),
    });

    const result = await runRecomputeScore("command_center", "command_center", opts, mockFetch);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Compute failed");
  });

  it("runRiskRules returns ok on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ created: 2, updated: 0 })),
    });

    const result = await runRiskRules(opts, mockFetch);

    expect(result.ok).toBe(true);
  });

  it("runNextActions returns ok on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ created: 1, updated: 0 })),
    });

    const result = await runNextActions("command_center", "command_center", opts, mockFetch);

    expect(result.ok).toBe(true);
  });
});
