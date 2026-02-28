/**
 * Phase 5.2: Coach action route contract tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/http/rate-limit", () => ({
  getRequestClientKey: () => "test-client",
  rateLimitByKey: vi.fn(() => ({ ok: true, remaining: 29, resetAt: Date.now() + 60_000 })),
}));

vi.mock("@/lib/api-utils", () => ({
  requireAuth: vi.fn(),
  jsonError: (msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), { status, headers: { "Content-Type": "application/json" } }),
  withRouteTiming: (_: string, fn: () => Promise<Response>) => fn(),
}));

vi.mock("@/lib/copilot/coach-actions", () => ({
  runCoachAction: vi.fn(),
  COACH_ACTION_KEYS: ["run_risk_rules", "run_next_actions", "recompute_score", "nba_execute"],
  NBA_ACTION_KEYS: ["mark_done", "snooze_1d", "dismiss", "don_t_suggest_again_30d"],
}));

vi.mock("@/lib/copilot/session-service", () => ({
  getSession: vi.fn().mockResolvedValue({ id: "sess-1", status: "open" }),
  addActionLog: vi.fn().mockResolvedValue({ id: "log-1" }),
  addMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/memory/attribution", () => ({
  loadAttributionContext: vi.fn().mockResolvedValue({
    score: { band: "healthy", score: 72, updatedAt: new Date().toISOString() },
    risk: { openCount: 0, criticalCount: 0, topKeys: [] },
    nba: { queuedCount: 2, topRuleKeys: [] },
  }),
  computeAttributionDelta: vi.fn().mockReturnValue({}),
  recordAttribution: vi.fn().mockResolvedValue("attr-1"),
  deltaToOutcome: vi.fn(),
}));

vi.mock("@/lib/memory/ingest", () => ({
  ingestFromCopilotActionLog: vi.fn().mockResolvedValue(undefined),
}));

describe("POST /api/internal/copilot/coach/action", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1", email: "t@t.com" }, expires: "" } as never);

    const { runCoachAction } = await import("@/lib/copilot/coach-actions");
    vi.mocked(runCoachAction).mockResolvedValue({
      ok: true,
      preview: { summary: "Preview", steps: ["Step 1"], warnings: [] },
      before: { score: "Score 72 (healthy)", risk: "Open: 0 critical/high", nba: "Queued: 2" },
    });
  });

  it("400 when sessionId missing", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/copilot/coach/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionKey: "run_risk_rules", mode: "preview" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("404 when session not found", async () => {
    const { getSession } = await import("@/lib/copilot/session-service");
    vi.mocked(getSession).mockResolvedValueOnce(null);

    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/copilot/coach/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionKey: "run_risk_rules", mode: "preview", sessionId: "nonexistent" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(404);
  });

  it("401 when unauthenticated", async () => {
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValueOnce(null);

    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/copilot/coach/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionKey: "run_risk_rules", mode: "preview", sessionId: "sess-1" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("preview returns before + preview", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/copilot/coach/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionKey: "run_risk_rules", mode: "preview", sessionId: "sess-1" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.preview).toBeDefined();
    expect(data.preview.summary).toBeDefined();
    expect(data.before).toBeDefined();
    expect(data.before.score).toBeDefined();
  });

  it("execute returns before + after", async () => {
    const { runCoachAction } = await import("@/lib/copilot/coach-actions");
    vi.mocked(runCoachAction).mockResolvedValueOnce({
      ok: true,
      preview: { summary: "Preview", steps: [], warnings: [] },
      execution: { resultSummary: "Done.", errors: [] },
      before: { score: "Score 72", risk: "Open: 1", nba: "Queued: 3" },
      after: { score: "Score 72", risk: "Open: 0", nba: "Queued: 2" },
    });

    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/copilot/coach/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionKey: "run_next_actions", mode: "execute", sessionId: "sess-1" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.before).toBeDefined();
    expect(data.after).toBeDefined();
    expect(data.execution).toBeDefined();
    expect(data.execution.resultSummary).toBe("Done.");
  });

  it("nba_execute missing nextActionId returns 400", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/copilot/coach/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionKey: "nba_execute", mode: "preview", sessionId: "sess-1", nbaActionKey: "mark_done" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("500 sanitizes Bearer token in error", async () => {
    const { runCoachAction } = await import("@/lib/copilot/coach-actions");
    vi.mocked(runCoachAction).mockRejectedValueOnce(new Error("Auth failed: Bearer sk_live_abc123"));

    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/copilot/coach/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionKey: "run_risk_rules", mode: "execute", sessionId: "sess-1" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).not.toContain("sk_live");
    expect(data.error).not.toContain("Bearer");
  });
});
