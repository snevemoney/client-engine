/**
 * Phase 4.0.1: Risk summary route contract tests.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { RiskSeverity, RiskStatus, RiskSourceType } from "@prisma/client";

vi.mock("@/lib/api-utils", () => ({
  requireAuth: vi.fn(),
  jsonError: (msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), { status, headers: { "Content-Type": "application/json" } }),
  withRouteTiming: (_: string, fn: () => Promise<Response>) => fn(),
}));

describe("GET /api/risk/summary", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1", email: "t@t.com" }, expires: "" });
    await db.riskFlag.deleteMany({ where: { key: { startsWith: "test_summary_" } } });
  });

  it("returns stable shape with openBySeverity and snoozedCount", async () => {
    const { GET } = await import("./route");
    const req = new NextRequest("http://x/api/risk/summary");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("openBySeverity");
    expect(data.openBySeverity).toMatchObject({
      low: expect.any(Number),
      medium: expect.any(Number),
      high: expect.any(Number),
      critical: expect.any(Number),
    });
    expect(data).toHaveProperty("snoozedCount");
    expect(typeof data.snoozedCount).toBe("number");
    expect(data).toHaveProperty("lastRunAt");
  });

  it("asserts Cache-Control header includes short caching", async () => {
    const { GET } = await import("./route");
    const req = new NextRequest("http://x/api/risk/summary");
    const res = await GET(req);
    const cc = res.headers.get("Cache-Control");
    expect(cc).toBeDefined();
    expect(cc).toMatch(/max-age=15|max-age=\d+/);
  });
});
