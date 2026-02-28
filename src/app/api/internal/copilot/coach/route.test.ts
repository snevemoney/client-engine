/**
 * Phase 5.1: Coach route contract tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/http/rate-limit", () => ({
  getRequestClientKey: () => "test-client",
  rateLimitByKey: vi.fn(() => ({ ok: true, remaining: 19, resetAt: Date.now() + 60_000 })),
}));

vi.mock("@/lib/api-utils", () => ({
  requireAuth: vi.fn(),
  jsonError: (msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), { status, headers: { "Content-Type": "application/json" } }),
  withRouteTiming: (_: string, fn: () => Promise<Response>) => fn(),
}));

vi.mock("@/lib/copilot/session-service", () => ({
  createSession: vi.fn().mockResolvedValue({ id: "sess-1", status: "open" }),
  addMessage: vi.fn().mockResolvedValue(undefined),
  getSession: vi.fn().mockResolvedValue({ id: "sess-1", status: "open" }),
}));

vi.mock("@/lib/copilot/coach-tools", () => ({
  getScoreContext: vi.fn().mockResolvedValue({
    latest: { score: 72, band: "healthy", computedAt: "2024-06-15T12:00:00Z" },
    recentEvents: [],
  }),
  getRiskContext: vi.fn().mockResolvedValue({
    summary: { openBySeverity: { critical: 0, high: 0 }, lastRunAt: "2024-06-15T10:00:00Z" },
    top: [],
  }),
  getNBAContext: vi.fn().mockResolvedValue({
    summary: { top5: [], queuedByPriority: {}, lastRunAt: "2024-06-15T09:00:00Z" },
    top: [],
  }),
}));

describe("POST /api/internal/copilot/coach", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1", email: "t@t.com" }, expires: "" } as never);
  });

  it("401 when unauthenticated", async () => {
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValueOnce(null);

    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/copilot/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "what should I do?" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("200 returns schema with reply and sources", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/copilot/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "what should I do today?" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("reply");
    expect(data.reply).toHaveProperty("status");
    expect(data.reply).toHaveProperty("diagnosis");
    expect(data.reply).toHaveProperty("topActions");
    expect(Array.isArray(data.reply.topActions)).toBe(true);
    expect(data.reply.topActions.length).toBeLessThanOrEqual(3);
    expect(data.reply).toHaveProperty("risksOrUnknowns");
    expect(data.reply).toHaveProperty("suggestedCommands");
    expect(data).toHaveProperty("sources");
    expect(data.sources).toHaveProperty("score");
    expect(data.sources).toHaveProperty("risk");
    expect(data.sources).toHaveProperty("nba");
    expect(data).toHaveProperty("sessionId");
    expect(data.sessionId).toBe("sess-1");
  });

  it("when tools fail, reply is safe and indicates missing info", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/copilot/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "status?" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.reply).toBeDefined();
    if (data.reply.status === "data_unavailable") {
      expect(data.reply.diagnosis).toMatch(/can't confirm|unavailable|failed/i);
    }
    expect(data.sources.score.latest).toBeDefined();
  });

  it("400 when message missing", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/copilot/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("500 sanitizes Bearer token in error", async () => {
    const coachTools = await import("@/lib/copilot/coach-tools");
    vi.mocked(coachTools.getScoreContext).mockRejectedValueOnce(
      new Error("Auth failed: Bearer sk_live_abc123")
    );

    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/copilot/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "status?" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).not.toContain("sk_live");
    expect(data.error).not.toContain("Bearer");
  });
});
