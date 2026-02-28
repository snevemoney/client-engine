/**
 * Phase 7.3: Memory attribution route tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api-utils", () => ({
  requireAuth: vi.fn(),
  jsonError: (msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), { status, headers: { "Content-Type": "application/json" } }),
  withRouteTiming: (_: string, fn: () => Promise<Response>) => fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    operatorAttribution: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

describe("GET /api/internal/memory/attribution", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1", email: "t@t.com" }, expires: "" } as never);
  });

  it("401 when unauthenticated", async () => {
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValueOnce(null);

    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/memory/attribution");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("200 returns items and range", async () => {
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/memory/attribution?range=7d");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("items");
    expect(data).toHaveProperty("range");
    expect(Array.isArray(data.items)).toBe(true);
  });

  it("filters by ruleKey when provided", async () => {
    const { db } = await import("@/lib/db");
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/memory/attribution?ruleKey=r1");
    await GET(req);

    expect(db.operatorAttribution.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ruleKey: "r1" }),
      })
    );
  });
});
