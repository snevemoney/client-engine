/**
 * Phase 4.2: Next Actions execute route contract tests.
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

vi.mock("@/lib/http/rate-limit", () => ({
  getRequestClientKey: () => "test-client",
  rateLimitByKey: () => ({ ok: true, remaining: 10, resetAt: Date.now() + 60_000 }),
}));

describe("POST /api/next-actions/[id]/execute", () => {
  let actionId: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1", email: "t@t.com" }, expires: "" } as never);

    await db.nextActionExecution.deleteMany({});
    const a = await db.nextBestAction.create({
      data: {
        title: "Test Execute Action",
        priority: NextActionPriority.high,
        score: 75,
        status: NextActionStatus.queued,
        sourceType: RiskSourceType.proposal,
        dedupeKey: `test_execute_nba:sys:${Date.now()}`,
        createdByRule: "test",
      },
    });
    actionId = a.id;
  });

  it("401 without auth", async () => {
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue(null);
    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/next-actions/1/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionKey: "mark_done" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: actionId }) });
    expect(res.status).toBe(401);
  });

  it("400 on invalid actionKey", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/next-actions/1/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionKey: "invalid_action" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: actionId }) });
    expect(res.status).toBe(400);
  });

  it("400 on missing actionKey", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/next-actions/1/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req, { params: Promise.resolve({ id: actionId }) });
    expect(res.status).toBe(400);
  });

  it("mark_done executes and returns ok", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/next-actions/1/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionKey: "mark_done" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: actionId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.executionId).toBeDefined();

    const updated = await db.nextBestAction.findUnique({ where: { id: actionId } });
    expect(updated?.status).toBe(NextActionStatus.done);
    expect(updated?.lastExecutedAt).toBeDefined();
    expect(updated?.lastExecutionStatus).toBe("success");

    const exec = await db.nextActionExecution.findFirst({
      where: { nextActionId: actionId, actionKey: "mark_done" },
    });
    expect(exec?.status).toBe("success");
  });

  it("snooze_1d sets snoozedUntil", async () => {
    const { POST } = await import("./route");
    const before = new Date();
    const req = new NextRequest("http://x/api/next-actions/1/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionKey: "snooze_1d" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: actionId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);

    const updated = await db.nextBestAction.findUnique({ where: { id: actionId } });
    expect(updated?.snoozedUntil).toBeDefined();
    const until = updated!.snoozedUntil!;
    expect(until.getTime()).toBeGreaterThan(before.getTime() + 23 * 60 * 60 * 1000);
  });

  it("404 for non-existent id", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/next-actions/1/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionKey: "mark_done" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "nonexistent_cuid_12345" }) });
    expect(res.status).toBe(404);
  });
});
