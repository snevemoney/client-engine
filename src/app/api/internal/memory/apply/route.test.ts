/**
 * Phase 7.2: Memory apply route tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
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
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/ops-events/log", () => ({
  logOpsEventSafe: vi.fn(),
}));

describe("POST /api/internal/memory/apply", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1", email: "t@t.com" }, expires: "" } as never);
  });

  it("401 when unauthenticated", async () => {
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValueOnce(null);

    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/memory/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "suppression_30d", ruleKey: "r1" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("400 when body missing type or ruleKey", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/memory/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruleKey: "r1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);

    const req2 = new NextRequest("http://localhost:3000/api/internal/memory/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "suppression_30d" }),
    });
    const res2 = await POST(req2);
    expect(res2.status).toBe(400);
  });

  it("200 creates preference when none exists", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.nextActionPreference.findFirst).mockResolvedValue(null);
    vi.mocked(db.nextActionPreference.create).mockResolvedValue({
      id: "pref1",
      ruleKey: "r1",
      suppressedUntil: new Date("2025-03-28"),
    } as never);

    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/memory/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "suppression_30d", ruleKey: "r1" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.preference.ruleKey).toBe("r1");
    expect(db.nextActionPreference.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: "command_center",
          entityId: "command_center",
          ruleKey: "r1",
          status: "active",
          reason: "Memory policy: earned suppression",
        }),
      })
    );
  });

  it("200 updates preference when exists", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.nextActionPreference.findFirst).mockResolvedValue({ id: "pref1" } as never);
    vi.mocked(db.nextActionPreference.update).mockResolvedValue({
      id: "pref1",
      ruleKey: "r1",
      suppressedUntil: new Date("2025-03-28"),
    } as never);

    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/memory/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "suppression_30d", ruleKey: "r1" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(db.nextActionPreference.update).toHaveBeenCalled();
    expect(db.nextActionPreference.create).not.toHaveBeenCalled();
  });
});
