/**
 * Phase 6.3.2: Growth outreach draft route contract tests.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { ProspectPlatform } from "@prisma/client";
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

describe("POST /api/internal/growth/outreach/draft", () => {
  const userId = "draft_route_user";
  let dealId: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: userId } } as never);

    const prospect = await db.prospect.create({
      data: {
        name: "Draft Test Prospect",
        handle: "draft_test_" + Date.now(),
        platform: ProspectPlatform.instagram,
      },
    });
    const deal = await db.deal.create({
      data: { prospectId: prospect.id, ownerUserId: userId },
    });
    dealId = deal.id;
  });

  it("returns 401 when unauthenticated", async () => {
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue(null as never);

    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/internal/growth/outreach/draft", {
      method: "POST",
      body: JSON.stringify({ dealId, templateKey: "broken_link_fix" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when dealId missing", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/internal/growth/outreach/draft", {
      method: "POST",
      body: JSON.stringify({ templateKey: "broken_link_fix" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("returns 400 when templateKey missing", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/internal/growth/outreach/draft", {
      method: "POST",
      body: JSON.stringify({ dealId }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/internal/growth/outreach/draft", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when deal not found", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/internal/growth/outreach/draft", {
      method: "POST",
      body: JSON.stringify({ dealId: "nonexistent", templateKey: "broken_link_fix" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns 200 with draftId, content, placeholders on success", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/internal/growth/outreach/draft", {
      method: "POST",
      body: JSON.stringify({ dealId, templateKey: "broken_link_fix", channel: "dm" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("draftId");
    expect(data).toHaveProperty("content");
    expect(data).toHaveProperty("placeholders");
    expect(data.placeholders).toContain("name");
    expect(data).toHaveProperty("nextFollowUpDays");
  });
});
