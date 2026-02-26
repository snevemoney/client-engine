/**
 * Phase 4.0.1: Next Actions summary route contract tests.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api-utils", () => ({
  requireAuth: vi.fn(),
  jsonError: (msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), { status, headers: { "Content-Type": "application/json" } }),
  withRouteTiming: (_: string, fn: () => Promise<Response>) => fn(),
}));

describe("GET /api/next-actions/summary", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1", email: "t@t.com" }, expires: "" });
  });

  it("returns stable shape with top5, queuedByPriority, lastRunAt", async () => {
    const { GET } = await import("./route");
    const req = new NextRequest("http://x/api/next-actions/summary");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("top5");
    expect(Array.isArray(data.top5)).toBe(true);
    expect(data).toHaveProperty("queuedByPriority");
    expect(data.queuedByPriority).toMatchObject({
      low: expect.any(Number),
      medium: expect.any(Number),
      high: expect.any(Number),
      critical: expect.any(Number),
    });
    expect(data).toHaveProperty("lastRunAt");
  });

  it("asserts Cache-Control header includes short caching", async () => {
    const { GET } = await import("./route");
    const req = new NextRequest("http://x/api/next-actions/summary");
    const res = await GET(req);
    const cc = res.headers.get("Cache-Control");
    expect(cc).toBeDefined();
    expect(cc).toMatch(/max-age=15|max-age=\d+/);
  });
});
