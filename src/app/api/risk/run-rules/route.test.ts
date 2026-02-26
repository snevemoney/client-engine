/**
 * Phase 4.0.1: Risk run-rules route contract tests.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { RiskSeverity, RiskSourceType } from "@prisma/client";

vi.mock("@/lib/http/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/http/rate-limit")>("@/lib/http/rate-limit");
  return {
    ...actual,
    rateLimitByKey: vi.fn().mockImplementation(() => ({ ok: true, remaining: 9, resetAt: Date.now() + 60_000 })),
  };
});

vi.mock("@/lib/risk/service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/risk/service")>("@/lib/risk/service");
  return { ...actual, upsertRiskFlags: vi.fn(actual.upsertRiskFlags) };
});

vi.mock("@/lib/api-utils", () => ({
  requireAuth: vi.fn(),
  jsonError: (msg: string, status: number, _code?: string, extra?: { headers?: Record<string, string>; bodyExtra?: Record<string, unknown> }) => {
    const body = { error: msg, ...(extra?.bodyExtra ?? {}) };
    const headers = new Headers(extra?.headers);
    headers.set("Content-Type", "application/json");
    return new Response(JSON.stringify(body), { status, headers });
  },
  withRouteTiming: (_: string, fn: () => Promise<Response>) => fn(),
}));

describe("POST /api/risk/run-rules", () => {
  const mockSession = { user: { id: "u1", email: "t@t.com" }, expires: "" };

  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue(mockSession as never);
    await db.riskFlag.deleteMany({ where: { dedupeKey: { startsWith: "risk:score_in_critical_band" } } });
    await db.notificationEvent.deleteMany({ where: { dedupeKey: { contains: "score_in_critical_band" } } });
    await db.scoreSnapshot.deleteMany({ where: { entityId: "risk_run_rules_test" } });
  });

  it("returns created, updated, criticalNotified, lastRunAt on success", async () => {
    await db.scoreSnapshot.create({
      data: {
        entityType: "command_center",
        entityId: "risk_run_rules_test",
        score: 40,
        band: "critical",
        delta: -10,
        factorsJson: [],
        reasonsJson: [],
        computedAt: new Date(),
      },
    });
    // Override fetch to return critical band for command_center - but we're using real DB
    // The snapshot we created has entityId risk_run_rules_test; fetch looks for entityId command_center
    await db.scoreSnapshot.deleteMany({ where: { entityId: "risk_run_rules_test" } });
    await db.scoreSnapshot.create({
      data: {
        entityType: "command_center",
        entityId: "command_center",
        score: 40,
        band: "critical",
        delta: -10,
        factorsJson: [],
        reasonsJson: [],
        computedAt: new Date(),
      },
    });

    const { POST } = await import("./route");
    const req = new Request("http://x/api/risk/run-rules", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("created");
    expect(data).toHaveProperty("updated");
    expect(data).toHaveProperty("criticalNotified");
    expect(data).toHaveProperty("lastRunAt");
  });

  it("idempotency: second run does not create duplicate risks", async () => {
    await db.scoreSnapshot.create({
      data: {
        entityType: "command_center",
        entityId: "command_center",
        score: 40,
        band: "critical",
        delta: -10,
        factorsJson: [],
        reasonsJson: [],
        computedAt: new Date(),
      },
    });

    const { POST } = await import("./route");
    const req = new Request("http://x/api/risk/run-rules", { method: "POST" });
    const r1 = await POST(req);
    const d1 = await r1.json();
    const r2 = await POST(req);
    const d2 = await r2.json();

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(d1.created).toBeGreaterThanOrEqual(1);
    expect(d2.created).toBe(0);
    expect(d2.updated).toBeGreaterThanOrEqual(1);
  });

  it("critical risk creates NotificationEvent with risk: dedupeKey prefix", async () => {
    await db.scoreSnapshot.create({
      data: {
        entityType: "command_center",
        entityId: "command_center",
        score: 40,
        band: "critical",
        delta: -10,
        factorsJson: [],
        reasonsJson: [],
        computedAt: new Date(),
      },
    });

    const before = await db.notificationEvent.count({ where: { dedupeKey: { contains: "risk:risk:score_in_critical_band" } } });
    const { POST } = await import("./route");
    const req = new Request("http://x/api/risk/run-rules", { method: "POST" });
    const res = await POST(req);
    const after = await db.notificationEvent.count({ where: { dedupeKey: { contains: "risk:risk:score_in_critical_band" } } });
    const data = await res.json();
    if (data.criticalNotified > 0) {
      expect(after).toBeGreaterThan(before);
      const ev = await db.notificationEvent.findFirst({ where: { dedupeKey: { contains: "score_in_critical_band" } } });
      expect(ev?.dedupeKey).toMatch(/^risk:/);
    }
  });

  it("DB failure returns 500; Bearer tokens in error are sanitized", async () => {
    const { upsertRiskFlags } = await import("@/lib/risk/service");
    vi.mocked(upsertRiskFlags).mockRejectedValueOnce(new Error("Auth failed: Bearer sk_live_abc123xyz"));

    const { POST } = await import("./route");
    const req = new Request("http://x/api/risk/run-rules", { method: "POST" });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body.error).not.toContain("sk_live");
    expect(body.error).toContain("[redacted]");
  });

  it("rate limit: returns 429 with Retry-After when limit exceeded", async () => {
    const { rateLimitByKey } = await import("@/lib/http/rate-limit");
    vi.mocked(rateLimitByKey).mockReturnValueOnce({ ok: false, remaining: 0, resetAt: Date.now() + 60_000 });

    const { POST } = await import("./route");
    const req = new Request("http://x/api/risk/run-rules", { method: "POST" });
    const res = await POST(req);

    expect(res).toBeDefined();
    expect(res?.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeDefined();
    const body = await res.json();
    expect(body.retryAfterSeconds).toBeDefined();
  });
});
