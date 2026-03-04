/**
 * Build route contract tests — auth, 404, approval gate, proposal gate, happy path.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/llm", () => ({
  chat: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ ok: true, remaining: 9, resetAt: Date.now() + 60_000 })),
}));

const BUILD_PREFIX = "build-test-";

describe("POST /api/build/[id]", () => {
  let leadId: string;
  let originalOpenai: string | undefined;

  beforeEach(async () => {
    vi.clearAllMocks();
    originalOpenai = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "sk-test";

    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", email: "t@t.com" },
      expires: "",
    } as never);
  });

  afterEach(async () => {
    process.env.OPENAI_API_KEY = originalOpenai;
    if (leadId) {
      await db.project.deleteMany({ where: { leadId } }).catch(() => {});
      await db.artifact.deleteMany({ where: { leadId } });
      await db.pipelineStepRun.deleteMany({ where: { run: { leadId } } }).catch(() => {});
      await db.pipelineRun.deleteMany({ where: { leadId } }).catch(() => {});
      await db.lead.delete({ where: { id: leadId } }).catch(() => {});
    }
  });

  it("returns 401 when not authenticated", async () => {
    const lead = await db.lead.create({
      data: {
        title: `${BUILD_PREFIX} ${Date.now()}`,
        source: "test",
        status: "APPROVED",
        techStack: [],
        tags: [],
      },
    });
    leadId = lead.id;
    await db.artifact.create({
      data: { leadId, type: "proposal", title: "PROPOSAL.md", content: "x" },
    });

    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue(null as never);

    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/build/" + leadId, { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: leadId }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when lead not found", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/build/clxxxxxxxxxxxxxxxxxxxxxxxxxx", {
      method: "POST",
    });
    const res = await POST(req, {
      params: Promise.resolve({ id: "clxxxxxxxxxxxxxxxxxxxxxxxxxx" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 when lead not APPROVED (approval gate)", async () => {
    const lead = await db.lead.create({
      data: {
        title: `${BUILD_PREFIX} ${Date.now()}`,
        source: "test",
        status: "SCORED",
        techStack: [],
        tags: [],
      },
    });
    leadId = lead.id;
    await db.artifact.create({
      data: { leadId, type: "proposal", title: "PROPOSAL.md", content: "x" },
    });

    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/build/" + leadId, { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: leadId }) });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("not approved");
    expect(data.requiredStatus).toBe("APPROVED or SCOPE_APPROVED");
  });

  it("returns 403 when no proposal artifact (positioning gate)", async () => {
    const lead = await db.lead.create({
      data: {
        title: `${BUILD_PREFIX} ${Date.now()}`,
        source: "test",
        status: "APPROVED",
        techStack: [],
        tags: [],
      },
    });
    leadId = lead.id;
    // No proposal artifact

    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/build/" + leadId, { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: leadId }) });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("No proposal artifact");
  });

  it("returns 200 with regenerated when project already exists", async () => {
    const lead = await db.lead.create({
      data: {
        title: `${BUILD_PREFIX} ${Date.now()}`,
        source: "test",
        status: "APPROVED",
        techStack: [],
        tags: [],
      },
    });
    leadId = lead.id;
    await db.artifact.create({
      data: { leadId, type: "proposal", title: "PROPOSAL.md", content: "x" },
    });
    await db.project.create({
      data: {
        slug: `build-test-${Date.now()}`,
        name: "Existing",
        techStack: [],
        screenshots: [],
        leadId,
      },
    });

    const { chat } = await import("@/lib/llm");
    vi.mocked(chat).mockResolvedValue({
      content: JSON.stringify({
        projectSpecMd: "Regenerated spec",
        doThisNextMd: "Regenerated tasks",
        cursorRulesMd: "Regenerated rules",
      }),
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    } as never);

    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/build/" + leadId, { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: leadId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.regenerated).toBe(true);
  });

  it("returns project and spec on success (happy path)", async () => {
    const lead = await db.lead.create({
      data: {
        title: `${BUILD_PREFIX} happy-${Date.now()}`,
        source: "test",
        status: "APPROVED",
        description: "Landing page",
        techStack: [],
        tags: [],
      },
    });
    leadId = lead.id;
    await db.artifact.create({
      data: { leadId, type: "proposal", title: "PROPOSAL.md", content: "x" },
    });

    const { chat } = await import("@/lib/llm");
    vi.mocked(chat).mockResolvedValue({
      content: JSON.stringify({
        projectSpecMd: "# Spec\nScope here",
        doThisNextMd: "- [ ] Task 1",
        cursorRulesMd: "# Rules",
      }),
      usage: { prompt_tokens: 100, completion_tokens: 200 },
    });

    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/build/" + leadId, { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: leadId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.project).toBeDefined();
    expect(data.project.slug).toBeDefined();
    expect(data.spec).toBeDefined();
    expect(data.tasks).toBeDefined();

    const updated = await db.lead.findUnique({ where: { id: leadId } });
    expect(updated?.status).toBe("BUILDING");
  });
});
