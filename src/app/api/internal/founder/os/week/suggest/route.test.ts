/**
 * Phase 6.2: Founder OS week suggest route tests.
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
  getRequestClientKey: () => "test-client",
  rateLimitByKey: vi.fn(() => ({ ok: true, remaining: 9, resetAt: Date.now() + 60_000 })),
}));

vi.mock("@/lib/db", () => ({
  db: {
    scoreSnapshot: { findFirst: vi.fn().mockResolvedValue(null) },
    riskFlag: { findMany: vi.fn().mockResolvedValue([]) },
    nextBestAction: { findMany: vi.fn().mockResolvedValue([]) },
    copilotActionLog: { findMany: vi.fn().mockResolvedValue([]) },
    nextActionExecution: { findMany: vi.fn().mockResolvedValue([]) },
    lead: {
      groupBy: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));

describe("POST /api/internal/founder/os/week/suggest", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1", email: "t@t.com" }, expires: "" } as never);
  });

  it("401 when unauthenticated", async () => {
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValueOnce(null);

    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/founder/os/week/suggest", { method: "POST" });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("200 returns 3 outcomes and includes sources", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.riskFlag.findMany).mockResolvedValue([
      { id: "r1", title: "Risk", severity: "critical", createdByRule: "rule_x" },
    ] as never);
    vi.mocked(db.nextBestAction.findMany).mockResolvedValue([
      {
        id: "n1",
        title: "NBA",
        reason: "Why",
        priority: "high",
        score: 80,
        createdByRule: "rule_y",
        dedupeKey: "dk1",
      },
    ] as never);

    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/founder/os/week/suggest", { method: "POST" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("topOutcomes");
    expect(data).toHaveProperty("milestones");
    expect(data).toHaveProperty("focusConstraint");
    expect(Array.isArray(data.topOutcomes)).toBe(true);
    expect(data.topOutcomes.length).toBeLessThanOrEqual(3);
    if (data.topOutcomes.length > 0) {
      expect(data.topOutcomes[0]).toHaveProperty("sources");
      expect(data.topOutcomes[0]).toHaveProperty("title");
      expect(data.topOutcomes[0].sources.length).toBeGreaterThanOrEqual(1);
    }
  });
});
