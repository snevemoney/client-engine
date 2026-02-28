/**
 * Phase 5.3: Sessions list route tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

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

vi.mock("@/lib/copilot/session-service", () => ({
  listSessions: vi.fn().mockResolvedValue([
    { id: "s1", title: "Session 1", status: "open", createdAt: new Date(), updatedAt: new Date() },
  ]),
}));

describe("GET /api/internal/copilot/sessions", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1", email: "t@t.com" }, expires: "" } as never);
  });

  it("401 when unauthenticated", async () => {
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValueOnce(null);

    const { GET } = await import("./route");
    const req = new Request("http://localhost:3000/api/internal/copilot/sessions");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("200 returns sessions list", async () => {
    const { GET } = await import("./route");
    const req = new Request("http://localhost:3000/api/internal/copilot/sessions");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("sessions");
    expect(Array.isArray(data.sessions)).toBe(true);
    expect(data.sessions.length).toBeGreaterThan(0);
    expect(data.sessions[0]).toHaveProperty("id");
    expect(data.sessions[0]).toHaveProperty("title");
  });
});
