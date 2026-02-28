/**
 * Phase 4.0.1: Risk PATCH [id] route contract tests.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { RiskSeverity, RiskStatus, RiskSourceType } from "@prisma/client";

vi.mock("@/lib/api-utils", () => ({
  requireAuth: vi.fn(),
  jsonError: (msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), { status, headers: { "Content-Type": "application/json" } }),
  withRouteTiming: (_: string, fn: () => Promise<Response>) => fn(),
}));

describe("PATCH /api/risk/[id]", () => {
  let riskId: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1", email: "t@t.com" }, expires: "" });

    const r = await db.riskFlag.create({
      data: {
        key: `test_patch_risk_${crypto.randomUUID()}`,
        title: "Patch Test",
        severity: RiskSeverity.high,
        status: RiskStatus.open,
        sourceType: RiskSourceType.proposal,
        dedupeKey: `test_patch_risk:sys:${crypto.randomUUID()}`,
        createdByRule: "test",
        lastSeenAt: new Date(),
      },
    });
    riskId = r.id;
  });

  it("dismiss sets status dismissed", async () => {
    const { PATCH } = await import("./route");
    const req = new NextRequest("http://x/api/risk/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: riskId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.action).toBe("dismiss");

    const updated = await db.riskFlag.findUnique({ where: { id: riskId } });
    expect(updated?.status).toBe(RiskStatus.dismissed);
  });

  it("resolve sets status resolved", async () => {
    const { PATCH } = await import("./route");
    const req = new NextRequest("http://x/api/risk/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: riskId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.action).toBe("resolve");

    const updated = await db.riskFlag.findUnique({ where: { id: riskId } });
    expect(updated?.status).toBe(RiskStatus.resolved);
  });

  it("snooze with preset 2d sets snoozedUntil", async () => {
    const { PATCH } = await import("./route");
    const req = new NextRequest("http://x/api/risk/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "snooze", preset: "2d" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: riskId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.action).toBe("snooze");
    expect(data.snoozedUntil).toBeDefined();

    const updated = await db.riskFlag.findUnique({ where: { id: riskId } });
    expect(updated?.status).toBe(RiskStatus.snoozed);
    expect(updated?.snoozedUntil).toBeDefined();
  });

  it("snooze without preset returns 400", async () => {
    const { PATCH } = await import("./route");
    const req = new NextRequest("http://x/api/risk/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "snooze" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: riskId }) });
    expect(res.status).toBe(400);
  });

  it("invalid action returns 400", async () => {
    const { PATCH } = await import("./route");
    const req = new NextRequest("http://x/api/risk/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "invalid" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: riskId }) });
    expect(res.status).toBe(400);
  });
});
