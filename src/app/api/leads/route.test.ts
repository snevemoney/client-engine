/**
 * Leads route contract tests — filter conditions, verdict, excludes.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";

vi.mock("@/lib/api-utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-utils")>("@/lib/api-utils");
  return {
    ...actual,
    requireAuth: vi.fn(),
    checkStateChangeRateLimit: vi.fn(() => null),
  };
});

const LEADS_PREFIX = "leads-route-test-";

describe("GET /api/leads", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({
      user: { id: "u1", email: "t@t.com" },
      expires: "",
    } as never);
  });

  afterEach(async () => {
    await db.lead.deleteMany({ where: { title: { contains: LEADS_PREFIX } } });
  });

  it("returns 401 when not authenticated", async () => {
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue(null);

    const { GET } = await import("./route");
    const req = new NextRequest("http://x/api/leads");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("filter by verdict returns only matching scoreVerdict", async () => {
    await db.lead.create({
      data: {
        title: `${LEADS_PREFIX} accept-${Date.now()}`,
        source: "test",
        status: "SCORED",
        scoreVerdict: "ACCEPT",
        techStack: [],
        tags: [],
      },
    });
    await db.lead.create({
      data: {
        title: `${LEADS_PREFIX} maybe-${Date.now()}`,
        source: "test",
        status: "SCORED",
        scoreVerdict: "MAYBE",
        techStack: [],
        tags: [],
      },
    });

    const { GET } = await import("./route");
    const req = new NextRequest("http://x/api/leads?verdict=ACCEPT");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.every((l: { scoreVerdict: string }) => l.scoreVerdict === "ACCEPT")).toBe(true);
  });

  it("filter by status returns only matching status", async () => {
    await db.lead.create({
      data: {
        title: `${LEADS_PREFIX} new-${Date.now()}`,
        source: "test",
        status: "NEW",
        techStack: [],
        tags: [],
      },
    });

    const { GET } = await import("./route");
    const req = new NextRequest("http://x/api/leads?status=NEW");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.every((l: { status: string }) => l.status === "NEW")).toBe(true);
  });
});
