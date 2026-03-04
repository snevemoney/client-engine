/**
 * Propose step tests — positioning gate, happy path, idempotency via step.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db } from "@/lib/db";
import { runPropose } from "./propose";

vi.mock("@/lib/llm", () => ({
  chat: vi.fn(),
}));

vi.mock("@/lib/revenue/roi", () => ({
  getLeadRoiEstimate: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/client-success", () => ({
  getClientSuccessData: vi.fn().mockResolvedValue({ resultTarget: null }),
}));

vi.mock("@/lib/pipeline/getLeadIntelligenceForLead", () => ({
  getLeadIntelligenceForLead: vi.fn().mockResolvedValue(null),
}));

const PROPOSE_PREFIX = "propose-test-";

describe("runPropose", () => {
  let leadId: string;
  let originalDryRun: string | undefined;

  beforeEach(async () => {
    originalDryRun = process.env.PIPELINE_DRY_RUN;
    process.env.PIPELINE_DRY_RUN = "0";

    const lead = await db.lead.create({
      data: {
        title: `${PROPOSE_PREFIX} ${Date.now()}`,
        source: "test",
        status: "SCORED",
        description: "Need a landing page",
        techStack: [],
        tags: [],
      },
    });
    leadId = lead.id;
  });

  afterEach(async () => {
    process.env.PIPELINE_DRY_RUN = originalDryRun;
    if (leadId) {
      await db.artifact.deleteMany({ where: { leadId } });
      await db.lead.delete({ where: { id: leadId } }).catch(() => {});
    }
  });

  it("throws when positioning artifact missing (gate)", async () => {
    await expect(runPropose(leadId)).rejects.toThrow(/POSITIONING_BRIEF|position step first/);
  });

  it("happy path: creates proposal when positioning exists", async () => {
    await db.artifact.create({
      data: {
        leadId,
        type: "positioning",
        title: "POSITIONING_BRIEF",
        content: "## Positioning\nWe focus on follow-up.",
      },
    });

    const { chat } = await import("@/lib/llm");
    vi.mocked(chat).mockResolvedValue({
      content: "# Proposal\n\nWe can build a landing page that converts.",
      usage: { prompt_tokens: 150, completion_tokens: 300 },
    });

    const result = await runPropose(leadId);

    expect(result.artifactId).toBeDefined();
    const artifact = await db.artifact.findFirst({
      where: { leadId, type: "proposal" },
    });
    expect(artifact).not.toBeNull();
    expect(artifact?.content).toContain("Proposal");
  });

  it("throws when lead not found", async () => {
    await expect(runPropose("clxxxxxxxxxxxxxxxxxxxxxxxxxx")).rejects.toThrow("Lead not found");
  });

  it("dry run creates placeholder when positioning exists", async () => {
    process.env.PIPELINE_DRY_RUN = "1";

    await db.artifact.create({
      data: {
        leadId,
        type: "positioning",
        title: "POSITIONING_BRIEF",
        content: "Positioning brief",
      },
    });

    const result = await runPropose(leadId);

    expect(result.artifactId).toBeDefined();
    const artifact = await db.artifact.findFirst({
      where: { leadId, type: "proposal" },
    });
    expect(artifact?.content).toContain("DRY RUN");
  });

  it("reuse existing: runPropose is not idempotent itself; step layer skips when hasProposal", async () => {
    await db.artifact.create({
      data: {
        leadId,
        type: "positioning",
        title: "POSITIONING_BRIEF",
        content: "Brief",
      },
    });

    const { chat } = await import("@/lib/llm");
    vi.mocked(chat).mockResolvedValue({
      content: "# Proposal v1",
      usage: { prompt_tokens: 100, completion_tokens: 200 },
    });

    const r1 = await runPropose(leadId);
    vi.mocked(chat).mockResolvedValue({
      content: "# Proposal v2",
      usage: { prompt_tokens: 100, completion_tokens: 200 },
    });
    const r2 = await runPropose(leadId);

    expect(r1.artifactId).not.toBe(r2.artifactId);
    const artifacts = await db.artifact.findMany({
      where: { leadId, type: "proposal" },
    });
    expect(artifacts.length).toBe(2);
  });
});
