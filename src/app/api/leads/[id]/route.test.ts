/**
 * Leads [id] PATCH route contract tests — auth, 404, valid update, field allowlist.
 * Phase 2: Uses lead-service; mocks requireAuth.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";

vi.mock("@/lib/api-utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-utils")>("@/lib/api-utils");
  return {
    ...actual,
    requireAuth: vi.fn(),
    checkStateChangeRateLimit: vi.fn(() => null),
  };
});

const LEAD_PREFIX = "leads-patch-test-";

async function createTestLead() {
  return db.lead.create({
    data: {
      title: `${LEAD_PREFIX} ${Date.now()}`,
      source: "test",
      status: "NEW",
      description: "Original",
      techStack: [],
      tags: [],
    },
  });
}

const mockSession = { user: { id: "u1", email: "t@t.com" }, expires: "" };

describe("PATCH /api/leads/[id]", () => {
  let leadId: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const lead = await createTestLead();
    leadId = lead.id;

    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue(mockSession as never);
  });

  afterEach(async () => {
    if (leadId) {
      await db.lead.delete({ where: { id: leadId } }).catch(() => {});
    }
  });

  it("returns 401 when not authenticated", async () => {
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue(null);

    const { PATCH } = await import("./route");
    const req = new NextRequest("http://x/api/leads/1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: leadId }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when lead not found", async () => {
    const { PATCH } = await import("./route");
    const req = new NextRequest("http://x/api/leads/clxxxxxxxxxxxxxxxxxxxxxxxxxx", {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated" }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "clxxxxxxxxxxxxxxxxxxxxxxxxxx" }),
    });
    expect(res.status).toBe(404);
  });

  it("updates allowed field and returns 200", async () => {
    const { PATCH } = await import("./route");
    const req = new NextRequest("http://x/api/leads/" + leadId, {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated Title", description: "New desc" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: leadId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.title).toBe("Updated Title");
    expect(data.description).toBe("New desc");

    const updated = await db.lead.findUnique({ where: { id: leadId } });
    expect(updated?.title).toBe("Updated Title");
  });

  it("returns 400 when trying to patch status (field allowlist)", async () => {
    const { PATCH } = await import("./route");
    const req = new NextRequest("http://x/api/leads/" + leadId, {
      method: "PATCH",
      body: JSON.stringify({ status: "APPROVED" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: leadId }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("cannot be updated");
  });

  it("returns 400 when trying to patch approvedAt (money-path lock)", async () => {
    const { PATCH } = await import("./route");
    const req = new NextRequest("http://x/api/leads/" + leadId, {
      method: "PATCH",
      body: JSON.stringify({ approvedAt: new Date().toISOString() }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: leadId }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const { PATCH } = await import("./route");
    const req = new NextRequest("http://x/api/leads/" + leadId, {
      method: "PATCH",
      body: "not json",
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: leadId }) });
    expect(res.status).toBe(400);
  });
});
