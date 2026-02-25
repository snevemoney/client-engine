/**
 * Phase 3.6.4: Route-level failure injection tests.
 * Verifies 500 responses are sanitized (no secrets, no stack traces).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api-utils", () => ({
  requireAuth: vi.fn(),
  jsonError: (msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), { status, headers: { "Content-Type": "application/json" } }),
  withRouteTiming: (_: string, fn: () => Promise<Response>) => fn(),
}));

vi.mock("@/lib/scoring/compute-and-store", () => ({
  computeAndStoreScore: vi.fn(),
}));

describe("scores route resilience (3.6.4)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1", email: "t@t.com" }, expires: "" });
  });

  describe("POST /api/internal/scores/compute", () => {
    it("returns 500 with sanitized message when computeAndStoreScore throws (no secret leakage)", async () => {
      const { computeAndStoreScore } = await import("@/lib/scoring/compute-and-store");
      vi.mocked(computeAndStoreScore).mockRejectedValueOnce(
        new Error("DB failed: Bearer sk-abc123xyz in connection")
      );

      const { POST } = await import("./compute/route");
      const req = new NextRequest("http://x/api/internal/scores/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType: "command_center", entityId: "cc" }),
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body).toHaveProperty("error");
      expect(body.error).not.toContain("sk-abc");
      expect(body.error).not.toContain("Bearer");
      expect(body.error).toContain("[redacted]");
    });

    it("returns 500 when computeAndStoreScore throws (no stack trace)", async () => {
      const { computeAndStoreScore } = await import("@/lib/scoring/compute-and-store");
      vi.mocked(computeAndStoreScore).mockRejectedValueOnce(new Error("Database connection refused"));

      const { POST } = await import("./compute/route");
      const req = new NextRequest("http://x/api/internal/scores/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType: "command_center", entityId: "cc" }),
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body).toHaveProperty("error");
      expect(body.error).not.toMatch(/at\s+\w+|stack|\.ts:\d+/i);
    });
  });
});
