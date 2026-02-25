/**
 * Phase 3.6.5: API-level golden replay — POST compute → GET summary → GET history.
 * Protects API contracts from drifting when engine/service changes.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { computeAndStoreScore } from "@/lib/scoring/compute-and-store";

const ENTITY = "golden_replay_api";

vi.mock("@/lib/api-utils", () => ({
  requireAuth: vi.fn(),
  jsonError: (msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), { status, headers: { "Content-Type": "application/json" } }),
  withRouteTiming: (_: string, fn: () => Promise<Response>) => fn(),
}));

describe("3.6.5 API golden replay", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1", email: "t@t.com" }, expires: "" });

    await db.scoreEvent.deleteMany({ where: { entityId: ENTITY } });
    await db.scoreSnapshot.deleteMany({ where: { entityId: ENTITY } });
  });

  it("threshold_breach: POST compute → GET summary → GET history, recentEvents includes breach", async () => {
    await computeAndStoreScore("command_center", ENTITY, {
      _testOverride: { score: 60, band: "warning" },
    });
    const r2 = await computeAndStoreScore("command_center", ENTITY, {
      _testOverride: { score: 40, band: "critical" },
    });

    const { GET: summaryGet } = await import("./summary/route");
    const summaryReq = new NextRequest(
      `http://x/api/internal/scores/summary?entityType=command_center&entityId=${ENTITY}`
    );
    const summaryRes = await summaryGet(summaryReq);
    const summary = await summaryRes.json();

    expect(summary.latest).not.toBeNull();
    expect(summary.latest.score).toBe(40);
    expect(summary.latest.band).toBe("critical");
    expect(summary.recentEvents).toBeDefined();
    const breachEvent = summary.recentEvents.find((e: { eventType: string }) => e.eventType === "threshold_breach");
    expect(breachEvent).toBeDefined();
    expect(breachEvent.fromScore).toBe(60);
    expect(breachEvent.toScore).toBe(40);
    expect(breachEvent.delta).toBe(-20);

    const { GET: historyGet } = await import("./history/route");
    const historyReq = new NextRequest(
      `http://x/api/internal/scores/history?entityType=command_center&entityId=${ENTITY}&range=7d`
    );
    const historyRes = await historyGet(historyReq);
    const history = await historyRes.json();

    expect(history.timeline).toBeDefined();
    expect(history.timeline.length).toBeGreaterThanOrEqual(2);
    expect(history.events).toBeDefined();
    const historyBreach = history.events.find((e: { eventType: string }) => e.eventType === "threshold_breach");
    expect(historyBreach).toBeDefined();
  });

  it("recovery: POST compute → GET summary, recovery event appears", async () => {
    await computeAndStoreScore("command_center", ENTITY, {
      _testOverride: { score: 45, band: "critical" },
    });
    await computeAndStoreScore("command_center", ENTITY, {
      _testOverride: { score: 85, band: "healthy" },
    });

    const { GET: summaryGet } = await import("./summary/route");
    const summaryReq = new NextRequest(
      `http://x/api/internal/scores/summary?entityType=command_center&entityId=${ENTITY}`
    );
    const summaryRes = await summaryGet(summaryReq);
    const summary = await summaryRes.json();

    expect(summary.latest).not.toBeNull();
    expect(summary.latest.score).toBe(85);
    expect(summary.latest.band).toBe("healthy");
    const recoveryEvent = summary.recentEvents.find((e: { eventType: string }) => e.eventType === "recovery");
    expect(recoveryEvent).toBeDefined();
    expect(recoveryEvent.fromBand).toBe("critical");
    expect(recoveryEvent.toBand).toBe("healthy");

    const { GET: historyGet } = await import("./history/route");
    const historyReq = new NextRequest(
      `http://x/api/internal/scores/history?entityType=command_center&entityId=${ENTITY}&range=7d`
    );
    const historyRes = await historyGet(historyReq);
    const history = await historyRes.json();

    const historyRecovery = history.events.find((e: { eventType: string }) => e.eventType === "recovery");
    expect(historyRecovery).toBeDefined();
  });
});
