/**
 * Growth prospects route contract tests.
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
    prospect: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: "p1", name: "Test", handle: "test", platform: "instagram" }),
    },
    deal: {
      create: vi.fn().mockResolvedValue({ id: "d1", stage: "new", nextFollowUpAt: null }),
    },
  },
}));

describe("GET /api/internal/growth/prospects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue(null as never);

    const { GET } = await import("./route");
    const req = new NextRequest("http://x/api/internal/growth/prospects");
    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data).toHaveProperty("error");
  });

  it("returns 200 with paginated shape", async () => {
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1" } } as never);

    const { GET } = await import("./route");
    const req = new NextRequest("http://x/api/internal/growth/prospects");
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
    vi.mocked(db.prospect.findMany).mockRejectedValueOnce(new Error("connection refused: Bearer sk_test_secret456"));

    const { GET } = await import("./route");
    const req = new NextRequest("http://x/api/internal/growth/prospects");
    const res = await GET(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data).toHaveProperty("error");
    expect(data.error).not.toContain("sk_test_secret456");
  });
});

describe("POST /api/internal/growth/prospects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue(null as never);

    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/internal/growth/prospects", {
      method: "POST",
      body: JSON.stringify({ name: "Test", platform: "instagram" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when name or platform missing", async () => {
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1" } } as never);

    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/internal/growth/prospects", {
      method: "POST",
      body: JSON.stringify({ name: "Test" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 with prospect and deal on success", async () => {
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1" } } as never);

    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/internal/growth/prospects", {
      method: "POST",
      body: JSON.stringify({ name: "Test", platform: "instagram" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("prospect");
    expect(data).toHaveProperty("deal");
  });
});
