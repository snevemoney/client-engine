/**
 * Orchestrator logic tests — runPipelineIfEligible flow, advisory lock, step loop.
 * Mocks steps to avoid LLM calls; uses test DB for lead/artifact state.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db } from "@/lib/db";
import {
  runPipelineIfEligible,
  isEligibleForAutoRun,
  type PipelineRunResult,
} from "./orchestrator";

const TEST_PREFIX = "orch-test-";

vi.mock("@/lib/pipeline/steps", () => ({
  runEnrichStep: vi.fn(),
  runScoreStep: vi.fn(),
  runPositionStep: vi.fn(),
  runProposeStep: vi.fn(),
}));

vi.mock("@/lib/db-lock", () => ({
  tryAdvisoryLock: vi.fn().mockResolvedValue(true),
  releaseAdvisoryLock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/notify", () => ({
  notifyPipelineFailure: vi.fn(),
}));

vi.mock("@/lib/analytics", () => ({
  trackPipelineEvent: vi.fn(),
}));

describe("isEligibleForAutoRun", () => {
  it("returns false for REJECTED status", () => {
    expect(isEligibleForAutoRun({ status: "REJECTED" })).toBe(false);
  });

  it("returns false when lead has project", () => {
    expect(isEligibleForAutoRun({ status: "NEW", project: { id: "p1" } })).toBe(false);
  });

  it("returns true for NEW lead without project", () => {
    expect(isEligibleForAutoRun({ status: "NEW" })).toBe(true);
  });

  it("returns true for ENRICHED lead without project", () => {
    expect(isEligibleForAutoRun({ status: "ENRICHED" })).toBe(true);
  });
});

describe("runPipelineIfEligible", () => {
  let leadId: string;
  let originalEnv: Record<string, string | undefined>;

  beforeEach(async () => {
    vi.clearAllMocks();
    originalEnv = {
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      PIPELINE_DRY_RUN: process.env.PIPELINE_DRY_RUN,
    };
    process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "sk-test";
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test";

    const { tryAdvisoryLock } = await import("@/lib/db-lock");
    vi.mocked(tryAdvisoryLock).mockResolvedValue(true);

    const lead = await db.lead.create({
      data: {
        title: `${TEST_PREFIX} ${Date.now()}`,
        source: "test",
        status: "NEW",
        description: "Test lead",
        techStack: [],
        tags: [],
      },
    });
    leadId = lead.id;
  });

  afterEach(async () => {
    Object.assign(process.env, originalEnv);
    if (leadId) {
      await db.pipelineStepRun.deleteMany({ where: { run: { leadId } } });
      await db.pipelineRun.deleteMany({ where: { leadId } });
      await db.artifact.deleteMany({ where: { leadId } });
      await db.lead.delete({ where: { id: leadId } }).catch(() => {});
    }
  });

  it("NEW lead → full pipeline → run: true with stepsRun", async () => {
    const { runEnrichStep, runScoreStep, runPositionStep, runProposeStep } =
      await import("@/lib/pipeline/steps");
    vi.mocked(runEnrichStep).mockResolvedValue({ skipped: false });
    vi.mocked(runScoreStep).mockResolvedValue({ skipped: false });
    vi.mocked(runPositionStep).mockResolvedValue({ skipped: false });
    vi.mocked(runProposeStep).mockResolvedValue({ skipped: false });

    const result = await runPipelineIfEligible(leadId, "test");

    expect(result).toMatchObject({ run: true, runId: expect.any(String), stepsRun: 4, stepsSkipped: 0 });
    expect(runEnrichStep).toHaveBeenCalled();
    expect(runScoreStep).toHaveBeenCalled();
    expect(runPositionStep).toHaveBeenCalled();
    expect(runProposeStep).toHaveBeenCalled();
  });

  it("REJECTED lead → run: false, reason: not_eligible", async () => {
    await db.lead.update({ where: { id: leadId }, data: { status: "REJECTED" } });

    const result = await runPipelineIfEligible(leadId, "test");

    expect(result).toEqual({ run: false, reason: "not_eligible" });
  });

  it("lead with project → run: false, reason: not_eligible", async () => {
    const proj = await db.project.create({
      data: {
        slug: `orch-proj-${Date.now()}`,
        name: "Test",
        techStack: [],
        screenshots: [],
        leadId,
      },
    });

    const result = await runPipelineIfEligible(leadId, "test");

    expect(result).toEqual({ run: false, reason: "not_eligible" });

    await db.project.update({ where: { id: proj.id }, data: { leadId: null } });
    await db.project.delete({ where: { id: proj.id } }).catch(() => {});
  });

  it("step throws → error status, lastErrorCode stored", async () => {
    const { runEnrichStep, runScoreStep } = await import("@/lib/pipeline/steps");
    vi.mocked(runEnrichStep).mockResolvedValue({ skipped: false });
    vi.mocked(runScoreStep).mockRejectedValue(new Error("OpenAI API error: 429 rate limit"));

    await expect(runPipelineIfEligible(leadId, "test")).rejects.toThrow(/429/);

    const run = await db.pipelineRun.findFirst({ where: { leadId }, orderBy: { startedAt: "desc" } });
    expect(run?.status).toBe("error");
    expect(run?.lastErrorCode).toBe("OPENAI_429");
    expect(run?.lastErrorAt).toBeInstanceOf(Date);
  });

  it("retry after ERROR → resumes from failed step (enrich skipped)", async () => {
    const { runEnrichStep, runScoreStep, runPositionStep, runProposeStep } =
      await import("@/lib/pipeline/steps");

    // First run: enrich succeeds, score fails
    vi.mocked(runEnrichStep).mockResolvedValue({ skipped: false });
    vi.mocked(runScoreStep).mockRejectedValueOnce(new Error("OpenAI API error: 429"));

    await expect(runPipelineIfEligible(leadId, "test")).rejects.toThrow(/429/);

    // Simulate enrich artifact and scoredAt from first run (score step didn't complete)
    await db.artifact.create({
      data: {
        leadId,
        type: "enrichment",
        title: "AI Enrichment Report",
        content: "{}",
      },
    });

    // Retry: enrich skipped (has artifact), score runs
    vi.mocked(runEnrichStep).mockResolvedValue({ skipped: true });
    vi.mocked(runScoreStep).mockResolvedValue({ skipped: false });
    vi.mocked(runPositionStep).mockResolvedValue({ skipped: false });
    vi.mocked(runProposeStep).mockResolvedValue({ skipped: false });

    const result = await runPipelineIfEligible(leadId, "retry");

    expect(result).toMatchObject({ run: true });
    expect(runEnrichStep).toHaveBeenCalled();
    const enrichCalls = vi.mocked(runEnrichStep).mock.calls;
    const enrichCurrent = enrichCalls[enrichCalls.length - 1]?.[3];
    expect(enrichCurrent?.artifacts.some((a) => a.type === "enrichment" && a.title === "AI Enrichment Report")).toBe(true);
  });

  it("already enriched → enrich skipped", async () => {
    await db.artifact.create({
      data: {
        leadId,
        type: "enrichment",
        title: "AI Enrichment Report",
        content: "{}",
      },
    });

    const { runEnrichStep, runScoreStep, runPositionStep, runProposeStep } =
      await import("@/lib/pipeline/steps");
    vi.mocked(runEnrichStep).mockResolvedValue({ skipped: true });
    vi.mocked(runScoreStep).mockResolvedValue({ skipped: false });
    vi.mocked(runPositionStep).mockResolvedValue({ skipped: false });
    vi.mocked(runProposeStep).mockResolvedValue({ skipped: false });

    const result = await runPipelineIfEligible(leadId, "test");

    expect(result).toMatchObject({ run: true, stepsSkipped: 1 });
    expect(runEnrichStep).toHaveBeenCalled();
  });

  it("locked lead → run: false, reason: locked", async () => {
    const { tryAdvisoryLock } = await import("@/lib/db-lock");
    vi.mocked(tryAdvisoryLock).mockResolvedValue(false);

    const result = await runPipelineIfEligible(leadId, "test");

    expect(result).toEqual({ run: false, reason: "locked" });
  });

  it("lead not found → run: false, reason: lead_not_found", async () => {
    const fakeId = "clxxxxxxxxxxxxxxxxxxxxxxxxxx";

    const result = await runPipelineIfEligible(fakeId, "test");

    expect(result).toEqual({ run: false, reason: "lead_not_found" });
  });

  it("no LLM keys → run: false, reason: llm_not_configured", async () => {
    const origAnthropic = process.env.ANTHROPIC_API_KEY;
    const origOpenai = process.env.OPENAI_API_KEY;
    process.env.ANTHROPIC_API_KEY = "";
    process.env.OPENAI_API_KEY = "";
    process.env.PIPELINE_DRY_RUN = "0";

    const result = await runPipelineIfEligible(leadId, "test");

    expect(result).toEqual({ run: false, reason: "llm_not_configured" });

    process.env.ANTHROPIC_API_KEY = origAnthropic;
    process.env.OPENAI_API_KEY = origOpenai;
  });

  it("status transitions correct: run ok → PipelineRun status ok", async () => {
    const { runEnrichStep, runScoreStep, runPositionStep, runProposeStep } =
      await import("@/lib/pipeline/steps");
    vi.mocked(runEnrichStep).mockResolvedValue({ skipped: false });
    vi.mocked(runScoreStep).mockResolvedValue({ skipped: false });
    vi.mocked(runPositionStep).mockResolvedValue({ skipped: false });
    vi.mocked(runProposeStep).mockResolvedValue({ skipped: false });

    const result = (await runPipelineIfEligible(leadId, "test")) as { run: true; runId: string };

    expect(result.run).toBe(true);
    const run = await db.pipelineRun.findUnique({ where: { id: result.runId } });
    expect(run?.status).toBe("ok");
    expect(run?.success).toBe(true);
    expect(run?.finishedAt).toBeInstanceOf(Date);
  });
});
