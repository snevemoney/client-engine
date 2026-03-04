/**
 * Pipeline retry route contract tests — auth, run: true/false, reason, details.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/pipeline/runPipeline", () => ({
  runPipelineIfEligible: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ ok: true, remaining: 9, resetAt: Date.now() + 60_000 })),
}));

const RETRY_PREFIX = "pipeline-retry-test-";

describe("POST /api/pipeline/retry/[leadId]", () => {
  let leadId: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", email: "t@t.com" },
      expires: "",
    } as never);

    const lead = await db.lead.create({
      data: {
        title: `${RETRY_PREFIX} ${Date.now()}`,
        source: "test",
        status: "NEW",
        techStack: [],
        tags: [],
      },
    });
    leadId = lead.id;
  });

  afterEach(async () => {
    if (leadId) {
      await db.lead.delete({ where: { id: leadId } }).catch(() => {});
    }
  });

  it("returns 401 when not authenticated", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue(null as never);

    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/pipeline/retry/1", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ leadId }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when lead not found", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/pipeline/retry/clxxxxxxxxxxxxxxxxxxxxxxxxxx", {
      method: "POST",
    });
    const res = await POST(req, {
      params: Promise.resolve({ leadId: "clxxxxxxxxxxxxxxxxxxxxxxxxxx" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns run: true with runId when pipeline runs", async () => {
    const { runPipelineIfEligible } = await import("@/lib/pipeline/runPipeline");
    vi.mocked(runPipelineIfEligible).mockResolvedValue({
      run: true,
      runId: "run-123",
      stepsRun: 4,
      stepsSkipped: 0,
    });

    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/pipeline/retry/" + leadId, { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ leadId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.run).toBe(true);
    expect(data.runId).toBe("run-123");
    expect(data.stepsRun).toBe(4);
    expect(data.stepsSkipped).toBe(0);
  });

  it("returns run: false with reason and details when not eligible", async () => {
    const { runPipelineIfEligible } = await import("@/lib/pipeline/runPipeline");
    vi.mocked(runPipelineIfEligible).mockResolvedValue({
      run: false,
      reason: "not_eligible",
    });

    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/pipeline/retry/" + leadId, { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ leadId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.run).toBe(false);
    expect(data.reason).toBe("not_eligible");
    expect(data.details).toBeDefined();
    expect(data.details.leadStatus).toBe("NEW");
  });
});
