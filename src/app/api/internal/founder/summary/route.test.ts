/**
 * Phase 6.1: Founder summary route tests.
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
    Promise.resolve(handler()).then((data) => {
      const res = new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "private, max-age=15" },
      });
      return res;
    })
  ),
}));

vi.mock("@/lib/db", () => ({
  db: {
    scoreSnapshot: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    riskFlag: {
      groupBy: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    nextBestAction: {
      findMany: vi.fn().mockResolvedValue([]),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    nextActionRun: { findFirst: vi.fn().mockResolvedValue(null) },
    lead: {
      groupBy: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    copilotActionLog: { findMany: vi.fn().mockResolvedValue([]) },
    nextActionExecution: {
      findMany: vi.fn().mockResolvedValue([]),
      include: vi.fn().mockReturnThis(),
    },
    jobRun: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

describe("GET /api/internal/founder/summary", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1", email: "t@t.com" }, expires: "" } as never);
  });

  it("401 when unauthenticated", async () => {
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValueOnce(null);

    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/founder/summary");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("200 returns expected shape", async () => {
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/founder/summary");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("score");
    expect(data).toHaveProperty("risk");
    expect(data).toHaveProperty("nba");
    expect(data).toHaveProperty("pipeline");
    expect(data).toHaveProperty("execution");
    expect(data).toHaveProperty("todayPlan");
    expect(data).toHaveProperty("entityType");
    expect(data).toHaveProperty("entityId");
    expect(Array.isArray(data.todayPlan)).toBe(true);
    expect(data.score).toHaveProperty("latest");
    expect(data.score).toHaveProperty("history7d");
    expect(data.risk).toHaveProperty("summary");
    expect(data.risk).toHaveProperty("topOpen5");
    expect(data.execution).toHaveProperty("recentCopilotActions");
    expect(data.execution).toHaveProperty("recentNextActionExecutions");
  });

  it("Cache-Control header present", async () => {
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/founder/summary");
    const res = await GET(req);

    const cc = res.headers.get("Cache-Control");
    expect(cc).toBeDefined();
    expect(cc).toMatch(/max-age=15|max-age=\d+/);
  });

  it("500 sanitizes error message", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.scoreSnapshot.findFirst).mockRejectedValueOnce(
      new Error("Auth failed: Bearer sk_live_abc123")
    );

    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/founder/summary");
    const res = await GET(req);

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).not.toContain("sk_live");
    expect(data.error).not.toContain("Bearer");
  });
});
