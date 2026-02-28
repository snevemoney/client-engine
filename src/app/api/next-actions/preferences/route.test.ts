/**
 * Phase 4.3: Preferences API route contract tests.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api-utils", () => ({
  requireAuth: vi.fn(),
  jsonError: (msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), { status, headers: { "Content-Type": "application/json" } }),
  withRouteTiming: (_: string, fn: () => Promise<Response>) => fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    nextActionPreference: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe("GET /api/next-actions/preferences", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1", email: "t@t.com" }, expires: "" } as never);
  });

  it("401 without auth", async () => {
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue(null);
    const { GET } = await import("./route");
    const req = new NextRequest("http://x/api/next-actions/preferences");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("400 when entityType missing", async () => {
    const { GET } = await import("./route");
    const req = new NextRequest("http://x/api/next-actions/preferences?entityId=command_center");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("200 returns items", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.nextActionPreference.findMany).mockResolvedValue([]);
    const { GET } = await import("./route");
    const req = new NextRequest("http://x/api/next-actions/preferences?entityType=command_center&entityId=command_center");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.items).toEqual([]);
  });
});

describe("POST /api/next-actions/preferences", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1", email: "t@t.com" }, expires: "" } as never);
  });

  it("401 without auth", async () => {
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue(null);
    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/next-actions/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType: "command_center", entityId: "command_center", ruleKey: "r1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("400 when ruleKey and dedupeKey both missing", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/next-actions/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType: "command_center", entityId: "command_center" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("200 creates preference", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.nextActionPreference.findFirst).mockResolvedValue(null);
    vi.mocked(db.nextActionPreference.create).mockResolvedValue({
      id: "pref1",
      entityType: "command_center",
      entityId: "command_center",
      ruleKey: "r1",
      dedupeKey: null,
      status: "active",
      suppressedUntil: new Date(),
      reason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/next-actions/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType: "command_center", entityId: "command_center", ruleKey: "r1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.preference.ruleKey).toBe("r1");
  });
});
