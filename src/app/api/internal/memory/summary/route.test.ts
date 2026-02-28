/**
 * Phase 7.1: Memory summary route tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api-utils", () => ({
  requireAuth: vi.fn(),
  jsonError: (msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), { status, headers: { "Content-Type": "application/json" } }),
  withRouteTiming: (_: string, fn: () => Promise<Response>) => fn(),
}));

vi.mock("@/lib/http/cached-handler", () => ({
  withSummaryCache: vi.fn((_key: string, handler: () => Promise<unknown>) =>
    Promise.resolve(handler()).then((data) =>
      new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "private, max-age=15" },
      })
    )
  ),
}));

vi.mock("@/lib/db", () => ({
  db: {
    operatorMemoryEvent: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    operatorLearnedWeight: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    riskFlag: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    operatorAttribution: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));

vi.mock("@/lib/memory/effectiveness", () => ({
  computeEffectiveness: vi.fn().mockResolvedValue({
    byRuleKey: {},
    topEffectiveRuleKeys: [],
    topNoisyRuleKeys: [],
    recommendedWeightAdjustments: [],
  }),
}));

describe("GET /api/internal/memory/summary", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1", email: "t@t.com" }, expires: "" } as never);
  });

  it("401 when unauthenticated", async () => {
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValueOnce(null);

    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/memory/summary");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("200 returns deterministic structure", async () => {
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/memory/summary");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("topRecurringRuleKeys");
    expect(data).toHaveProperty("topSuccessfulRuleKeys");
    expect(data).toHaveProperty("topDismissedRuleKeys");
    expect(data).toHaveProperty("suggestedSuppressions");
    expect(data).toHaveProperty("trendDiffs");
    expect(data).toHaveProperty("patternAlerts");
    expect(data).toHaveProperty("policySuggestions");
    expect(data).toHaveProperty("lastUpdatedAt");
    expect(data).toHaveProperty("range");
    expect(Array.isArray(data.topRecurringRuleKeys)).toBe(true);
    expect(Array.isArray(data.suggestedSuppressions)).toBe(true);
    expect(data.trendDiffs).toHaveProperty("recurring");
    expect(data.trendDiffs).toHaveProperty("dismissed");
    expect(data.trendDiffs).toHaveProperty("successful");
    expect(Array.isArray(data.patternAlerts)).toBe(true);
    expect(data).toHaveProperty("topEffectiveRuleKeys");
    expect(data).toHaveProperty("topNoisyRuleKeys");
    expect(data).toHaveProperty("effectiveness");
    expect(data).toHaveProperty("attributionTotals");
  });
});
