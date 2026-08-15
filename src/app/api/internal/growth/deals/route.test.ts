/**
 * Growth deals route contract tests.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/http/rate-limit", () => ({
  getRequestClientKey: () => "test",
  rateLimitByKey: () => ({ ok: true, remaining: 10, resetAt: Date.now() + 60_000 }),
}));

vi.mock("@/lib/api-utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-utils")>("@/lib/api-utils");
  return {
    ...actual,
    requireAuth: vi.fn(),
    withRouteTiming: (_: string, fn: () => Promise<unknown>) => fn(),
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    deal: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: "d1", stage: "new", prospectId: "p1" }),
    },
    prospect: {
      findUnique: vi.fn().mockResolvedValue({ id: "p1", name: "Test", handle: "test", platform: "instagram", opportunityScore: 5 }),
    },
  },
}));

describe("GET /api/internal/growth/deals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue(null as never);

    const { GET } = await import("./route");
    const req = new NextRequest("http://x/api/internal/growth/deals");
    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data).toHaveProperty("error");
  });

  it("returns 200 with paginated shape", async () => {
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1" } } as never);

    const { GET } = await import("./route");
    const req = new NextRequest("http://x/api/internal/growth/deals");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("items");
    expect(data).toHaveProperty("total");
    expect(data).toHaveProperty("page");
    expect(data).toHaveProperty("pageSize");
  });

  it("returns 500 with sanitized error on DB failure", async () => {
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1" } } as never);

    const { db } = await import("@/lib/db");
    vi.mocked(db.deal.findMany).mockRejectedValueOnce(new Error("DB connection lost: Bearer sk_live_abc123xyz"));

    const { GET } = await import("./route");
    const req = new NextRequest("http://x/api/internal/growth/deals");
    const res = await GET(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data).toHaveProperty("error");
    expect(data.error).not.toContain("sk_live_abc123xyz");
  });
});

describe("POST /api/internal/growth/deals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue(null as never);

    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/internal/growth/deals", {
      method: "POST",
      body: JSON.stringify({ prospectId: "p1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when prospectId missing", async () => {
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1" } } as never);

    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/internal/growth/deals", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 with deal on success", async () => {
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1" } } as never);

    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/internal/growth/deals", {
      method: "POST",
      body: JSON.stringify({ prospectId: "p1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("deal");
  });
});
