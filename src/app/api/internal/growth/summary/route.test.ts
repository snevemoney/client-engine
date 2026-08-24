/**
 * Growth summary route contract tests.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api-utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-utils")>("@/lib/api-utils");
  return {
    ...actual,
    requireAuth: vi.fn(),
    withRouteTiming: (_: string, fn: () => Promise<unknown>) => fn(),
  };
});

vi.mock("@/lib/http/cached-handler", async () => {
  const { NextResponse } = await import("next/server");
  return {
    withSummaryCache: async (_key: string, fn: () => Promise<unknown>) => {
      const data = await fn();
      return NextResponse.json(data);
    },
  };
});

vi.mock("@/lib/growth/summary", () => ({
  computeGrowthSummary: vi.fn().mockResolvedValue({
    dealsCount: 5,
    prospectsCount: 3,
    overdueFollowups: 1,
    totalValueCad: 15000,
    dealsByStage: {},
  }),
}));

describe("GET /api/internal/growth/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue(null as never);

    const { GET } = await import("./route");
    const req = new NextRequest("http://x/api/internal/growth/summary");
    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data).toHaveProperty("error");
  });

  it("returns 200 with summary shape", async () => {
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1" } } as never);

    const { GET } = await import("./route");
    const req = new NextRequest("http://x/api/internal/growth/summary");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("dealsCount");
    expect(data).toHaveProperty("prospectsCount");
  });

  it("returns 500 with sanitized error on service failure", async () => {
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1" } } as never);

    const { computeGrowthSummary } = await import("@/lib/growth/summary");
    vi.mocked(computeGrowthSummary).mockRejectedValueOnce(new Error("DB error: sk_live_supersecret"));

    const { GET } = await import("./route");
    const req = new NextRequest("http://x/api/internal/growth/summary");
    const res = await GET(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data).toHaveProperty("error");
    expect(data.error).not.toContain("sk_live_supersecret");
  });
});
