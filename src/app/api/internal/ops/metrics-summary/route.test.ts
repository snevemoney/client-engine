/**
 * Phase 3.6.4: Metrics-summary route resilience.
 * Verifies 500 with sanitized message when getMetricsSummary throws.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api-utils", () => ({
  requireAuth: vi.fn(),
  jsonError: (msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), { status, headers: { "Content-Type": "application/json" } }),
  withRouteTiming: (_: string, fn: () => Promise<Response>) => fn(),
}));

vi.mock("@/lib/notifications/metrics", () => ({
  getMetricsSummary: vi.fn(),
}));

describe("metrics-summary route resilience (3.6.4)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1", email: "t@t.com" }, expires: "" });
  });

  it("returns 500 with sanitized message when getMetricsSummary throws", async () => {
    const { getMetricsSummary } = await import("@/lib/notifications/metrics");
    vi.mocked(getMetricsSummary).mockRejectedValueOnce(new Error("DB connection failed"));

    const { GET } = await import("./route");
    const req = new NextRequest("http://x/api/internal/ops/metrics-summary?period=24h");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toHaveProperty("error");
    expect(body.error).not.toMatch(/at\s+\w+|stack|\.ts:\d+/i);
    expect(body.error).not.toContain("sk_");
  });
});
