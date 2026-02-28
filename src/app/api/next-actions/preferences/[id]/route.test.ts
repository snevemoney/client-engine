/**
 * Phase 4.3: Preferences [id] API route contract tests.
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
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

describe("PATCH /api/next-actions/preferences/[id]", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1", email: "t@t.com" }, expires: "" } as never);
  });

  it("401 without auth", async () => {
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue(null);
    const { PATCH } = await import("./route");
    const req = new NextRequest("http://x/api/next-actions/preferences/pref1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "suppressed" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "pref1" }) });
    expect(res.status).toBe(401);
  });

  it("404 when preference not found", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.nextActionPreference.findUnique).mockResolvedValue(null);
    const { PATCH } = await import("./route");
    const req = new NextRequest("http://x/api/next-actions/preferences/pref1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "suppressed" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "pref1" }) });
    expect(res.status).toBe(404);
  });

  it("200 re-enables preference", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.nextActionPreference.findUnique).mockResolvedValue({ id: "pref1" } as never);
    vi.mocked(db.nextActionPreference.update).mockResolvedValue({} as never);
    const { PATCH } = await import("./route");
    const req = new NextRequest("http://x/api/next-actions/preferences/pref1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "suppressed" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "pref1" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.action).toBe("re-enabled");
  });
});

describe("DELETE /api/next-actions/preferences/[id]", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1", email: "t@t.com" }, expires: "" } as never);
  });

  it("401 without auth", async () => {
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue(null);
    const { DELETE } = await import("./route");
    const req = new NextRequest("http://x/api/next-actions/preferences/pref1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "pref1" }) });
    expect(res.status).toBe(401);
  });

  it("200 deletes preference", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.nextActionPreference.delete).mockResolvedValue({} as never);
    const { DELETE } = await import("./route");
    const req = new NextRequest("http://x/api/next-actions/preferences/pref1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "pref1" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });
});
