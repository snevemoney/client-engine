/**
 * Propose route contract tests — auth, 404, OPENAI gate, happy path.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/pipeline/propose", () => ({
  runPropose: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ ok: true, remaining: 9, resetAt: Date.now() + 60_000 })),
}));

const PROPOSE_PREFIX = "propose-test-";

describe("POST /api/propose/[id]", () => {
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

    const lead = await db.lead.create({
      data: {
        title: `${PROPOSE_PREFIX} ${Date.now()}`,
        source: "test",
        status: "SCORED",
        techStack: [],
        tags: [],
      },
    });
    leadId = lead.id;
  });

  afterEach(async () => {
    process.env.OPENAI_API_KEY = originalOpenai;
    if (leadId) {
      await db.artifact.deleteMany({ where: { leadId } });
      await db.pipelineStepRun.deleteMany({ where: { run: { leadId } } });
      await db.pipelineRun.deleteMany({ where: { leadId } });
      await db.lead.delete({ where: { id: leadId } }).catch(() => {});
    }
  });

  it("returns 401 when not authenticated", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue(null as never);

    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/propose/1", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: leadId }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when lead not found", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/propose/clxxxxxxxxxxxxxxxxxxxxxxxxxx", {
      method: "POST",
    });
    const res = await POST(req, {
      params: Promise.resolve({ id: "clxxxxxxxxxxxxxxxxxxxxxxxxxx" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 500 when OPENAI_API_KEY not configured", async () => {
    process.env.OPENAI_API_KEY = "";

    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/propose/" + leadId, { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: leadId }) });
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain("OPENAI_API_KEY");
  });

  it("returns artifact on success (happy path)", async () => {
    const { runPropose } = await import("@/lib/pipeline/propose");
    const mockArtifact = await db.artifact.create({
      data: {
        leadId,
        type: "proposal",
        title: "PROPOSAL.md",
        content: "# Proposal\n\nTest content",
      },
    });
    vi.mocked(runPropose).mockResolvedValue({
      artifactId: mockArtifact.id,
      usage: { prompt_tokens: 100, completion_tokens: 200 },
    });

    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/propose/" + leadId, { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: leadId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(mockArtifact.id);
    expect(data.type).toBe("proposal");
  });

  it("returns 500 when runPropose throws", async () => {
    const { runPropose } = await import("@/lib/pipeline/propose");
    vi.mocked(runPropose).mockRejectedValue(new Error("LLM failed"));

    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/propose/" + leadId, { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: leadId }) });
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });
});
