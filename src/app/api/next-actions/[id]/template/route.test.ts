/**
 * Phase 4.4.1: Template route contract tests.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";

vi.mock("@/lib/api-utils", () => ({
  requireAuth: vi.fn(),
  jsonError: (msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), { status, headers: { "Content-Type": "application/json" } }),
  withRouteTiming: (_: string, fn: () => Promise<Response>) => fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    nextBestAction: {
      findUnique: vi.fn(),
    },
  },
}));

describe("GET /api/next-actions/[id]/template", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1", email: "t@t.com" }, expires: "" } as never);
  });

  it("401 without auth", async () => {
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue(null);
    const { GET } = await import("./route");
    const req = new NextRequest("http://x/api/next-actions/1/template");
    const res = await GET(req, { params: Promise.resolve({ id: "any" }) });
    expect(res.status).toBe(401);
  });

  it("404 when NBA not found", async () => {
    vi.mocked(db.nextBestAction.findUnique).mockResolvedValue(null);
    const { GET } = await import("./route");
    const req = new NextRequest("http://x/api/next-actions/template");
    const res = await GET(req, { params: Promise.resolve({ id: "nonexistent" }) });
    expect(res.status).toBe(404);
  });

  it("200 returns template for known templateKey", async () => {
    vi.mocked(db.nextBestAction.findUnique).mockResolvedValue({
      id: "nba1",
      templateKey: "score_in_critical_band",
      createdByRule: "score_in_critical_band",
    } as never);
    const { GET } = await import("./route");
    const req = new NextRequest("http://x/api/next-actions/template");
    const res = await GET(req, { params: Promise.resolve({ id: "nba1" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.nextActionId).toBe("nba1");
    expect(data.template).not.toBeNull();
    expect(data.template.title).toBe("Investigate top score reasons");
    expect(data.template.checklist.length).toBeGreaterThanOrEqual(2);
  });

  it("200 returns template: null for unknown templateKey", async () => {
    vi.mocked(db.nextBestAction.findUnique).mockResolvedValue({
      id: "nba2",
      templateKey: "unknown_rule_xyz",
      createdByRule: "unknown_rule_xyz",
    } as never);
    const { GET } = await import("./route");
    const req = new NextRequest("http://x/api/next-actions/template");
    const res = await GET(req, { params: Promise.resolve({ id: "nba2" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.nextActionId).toBe("nba2");
    expect(data.template).toBeNull();
  });

  it("500 sanitizes Bearer token in error", async () => {
    vi.mocked(db.nextBestAction.findUnique).mockRejectedValue(
      new Error("Auth failed: Bearer sk_live_abc123")
    );
    const { GET } = await import("./route");
    const req = new NextRequest("http://x/api/next-actions/template");
    const res = await GET(req, { params: Promise.resolve({ id: "nba1" }) });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).not.toContain("sk_live");
    expect(body.error).toContain("[redacted]");
  });
});
