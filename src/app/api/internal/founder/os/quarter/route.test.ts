/**
 * Phase 6.2: Founder OS quarter route tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api-utils", () => ({
  requireAuth: vi.fn(),
  jsonError: (msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), { status, headers: { "Content-Type": "application/json" } }),
  withRouteTiming: (_: string, fn: () => Promise<Response>) => fn(),
}));

vi.mock("@/lib/http/cached-handler", () => ({
  withSummaryCache: vi.fn((_key: string, handler: () => Promise<unknown>) =>
    Promise.resolve(handler()).then((data) =>
      new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "private, max-age=15" },
      })
    )
  ),
}));

vi.mock("@/lib/db", () => ({
  db: {
    founderQuarter: {
      findFirst: vi.fn(),
    },
  },
}));

describe("GET /api/internal/founder/os/quarter", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1", email: "t@t.com" }, expires: "" } as never);
    const { db } = await import("@/lib/db");
    vi.mocked(db.founderQuarter.findFirst).mockResolvedValue(null);
  });

  it("401 when unauthenticated", async () => {
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValueOnce(null);

    const { GET } = await import("./route");
    const res = await GET();

    expect(res.status).toBe(401);
  });

  it("200 returns quarter shape", async () => {
    const { GET } = await import("./route");
    const res = await GET();

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("startsAt");
    expect(data).toHaveProperty("endsAt");
    expect(data).toHaveProperty("title");
    expect(data).toHaveProperty("kpis");
    expect(Array.isArray(data.kpis)).toBe(true);
  });
});
