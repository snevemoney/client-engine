/**
 * Phase 7.2: Memory run route tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api-utils", () => ({
  requireAuth: vi.fn(),
  jsonError: (msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), { status, headers: { "Content-Type": "application/json" } }),
  withRouteTiming: (_: string, fn: () => Promise<Response>) => fn(),
}));

vi.mock("@/lib/http/rate-limit", () => ({
  getRequestClientKey: vi.fn(() => "user:u1"),
  rateLimitByKey: vi.fn(() => ({ ok: true, remaining: 4, resetAt: Date.now() + 60_000 })),
}));

vi.mock("@/lib/memory/policy", () => ({
  computeWindowStats: vi.fn().mockResolvedValue({ byRuleKey: {} }),
  computeTrendDiffs: vi.fn().mockReturnValue({
    recurring: [],
    dismissed: [],
    successful: [],
  }),
  derivePolicySuggestions: vi.fn().mockReturnValue([]),
  buildPatternAlerts: vi.fn().mockReturnValue([]),
}));

vi.mock("@/lib/memory/alerts", () => ({
  createOrUpdatePatternRiskFlag: vi.fn().mockResolvedValue({ riskFlagId: "rf1" }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    nextActionPreference: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe("POST /api/internal/memory/run", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1", email: "t@t.com" }, expires: "" } as never);
  });

  it("401 when unauthenticated", async () => {
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValueOnce(null);

    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/memory/run", { method: "POST" });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("200 runs policy and returns structure", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/memory/run", { method: "POST" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data).toHaveProperty("patternAlertsRaised");
    expect(data).toHaveProperty("riskFlagIds");
    expect(data).toHaveProperty("autoApplyEnabled");
  });

  it("429 when rate limit exceeded", async () => {
    const { rateLimitByKey } = await import("@/lib/http/rate-limit");
    vi.mocked(rateLimitByKey).mockReturnValueOnce({
      ok: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    });

    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/memory/run", { method: "POST" });
    const res = await POST(req);

    expect(res.status).toBe(429);
  });

  it("raises risk flags for pattern alerts", async () => {
    const { buildPatternAlerts } = await import("@/lib/memory/policy");
    const { createOrUpdatePatternRiskFlag } = await import("@/lib/memory/alerts");
    vi.mocked(buildPatternAlerts).mockReturnValueOnce([
      {
        ruleKey: "r1",
        severity: "medium" as const,
        title: "Pattern alert: r1",
        description: "2 failures",
        dedupeKey: "pattern:r1:2025-02-26",
      },
    ]);

    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/memory/run", { method: "POST" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(createOrUpdatePatternRiskFlag).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "u1",
        ruleKey: "r1",
        severity: "medium",
      })
    );
  });
});
