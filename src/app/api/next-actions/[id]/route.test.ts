/**
 * Phase 4.0.1: Next Actions PATCH [id] route contract tests.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { NextActionPriority, NextActionStatus, RiskSourceType } from "@prisma/client";

vi.mock("@/lib/api-utils", () => ({
  requireAuth: vi.fn(),
  jsonError: (msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), { status, headers: { "Content-Type": "application/json" } }),
  withRouteTiming: (_: string, fn: () => Promise<Response>) => fn(),
}));

describe("PATCH /api/next-actions/[id]", () => {
  let actionId: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1", email: "t@t.com" }, expires: "" });

    const a = await db.nextBestAction.create({
      data: {
        title: "Test Patch Action",
        priority: NextActionPriority.high,
        score: 75,
        status: NextActionStatus.queued,
        sourceType: RiskSourceType.proposal,
        dedupeKey: `test_patch_nba:sys:${Date.now()}`,
        createdByRule: "test",
      },
    });
    actionId = a.id;
  });

  it("done sets status done", async () => {
    const { PATCH } = await import("./route");
    const req = new NextRequest("http://x/api/next-actions/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "done" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: actionId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.action).toBe("done");

    const updated = await db.nextBestAction.findUnique({ where: { id: actionId } });
    expect(updated?.status).toBe(NextActionStatus.done);
  });

  it("dismiss sets status dismissed", async () => {
    const { PATCH } = await import("./route");
    const req = new NextRequest("http://x/api/next-actions/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: actionId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.action).toBe("dismiss");

    const updated = await db.nextBestAction.findUnique({ where: { id: actionId } });
    expect(updated?.status).toBe(NextActionStatus.dismissed);
  });

  it("invalid action returns 400", async () => {
    const { PATCH } = await import("./route");
    const req = new NextRequest("http://x/api/next-actions/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "bad" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: actionId }) });
    expect(res.status).toBe(400);
  });
});
