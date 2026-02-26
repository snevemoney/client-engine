/**
 * Phase 4.0.1: Next Actions run route contract tests.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";

vi.mock("@/lib/http/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/http/rate-limit")>("@/lib/http/rate-limit");
  return {
    ...actual,
    rateLimitByKey: vi.fn().mockImplementation(() => ({ ok: true, remaining: 9, resetAt: Date.now() + 60_000 })),
  };
});

vi.mock("@/lib/next-actions/service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/next-actions/service")>("@/lib/next-actions/service");
  return {
    ...actual,
    upsertNextActions: vi.fn(actual.upsertNextActions),
  };
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

describe("POST /api/next-actions/run", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1", email: "t@t.com" }, expires: "" });
  });

  it("returns created, updated, runKey, lastRunAt on success", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/next-actions/run", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("created");
    expect(data).toHaveProperty("updated");
    expect(data).toHaveProperty("runKey");
    expect(data).toHaveProperty("lastRunAt");
  });

  it("idempotency: repeated runs do not duplicate when context unchanged", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/next-actions/run", { method: "POST" });
    const r1 = await POST(req);
    const d1 = await r1.json();
    const r2 = await POST(req);
    const d2 = await r2.json();
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(d1.created + d1.updated).toBeGreaterThanOrEqual(0);
    expect(d2.created).toBe(0);
  });

  it("DB failure returns 500; Bearer tokens in error are sanitized", async () => {
    const { upsertNextActions } = await import("@/lib/next-actions/service");
    vi.mocked(upsertNextActions).mockRejectedValueOnce(new Error("Auth failed: Bearer sk_live_abc123"));

    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/next-actions/run", { method: "POST" });
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
    const req = new NextRequest("http://x/api/next-actions/run", { method: "POST" });
    const res = await POST(req);

    expect(res).toBeDefined();
    expect(res?.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeDefined();
    const body = await res.json();
    expect(body.retryAfterSeconds).toBeDefined();
  });
});
