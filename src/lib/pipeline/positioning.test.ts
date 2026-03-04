/**
 * Positioning step tests — happy path, no enrichment artifact, idempotency.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db } from "@/lib/db";
import { runPositioning } from "./positioning";

vi.mock("@/lib/llm", () => ({
  chat: vi.fn(),
}));

const POS_PREFIX = "positioning-test-";

describe("runPositioning", () => {
  let leadId: string;
  let originalDryRun: string | undefined;

  beforeEach(async () => {
    originalDryRun = process.env.PIPELINE_DRY_RUN;
    process.env.PIPELINE_DRY_RUN = "0";

    const lead = await db.lead.create({
      data: {
        title: `${POS_PREFIX} ${Date.now()}`,
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

  it("happy path: creates positioning artifact with valid LLM response", async () => {
    const { chat } = await import("@/lib/llm");
    vi.mocked(chat).mockResolvedValue({
      content: `---METADATA---
{"feltProblem":"Need online presence","languageMap":{"use":["results"],"avoid":[],"competitorOveruse":[]},"reframedOffer":"Landing page that converts","blueOceanAngle":"Focus on follow-up","packaging":{"solutionName":"Landing Page","doNotMention":[],"hookOneLiner":"Get more leads from your site"}}
---BRIEF---
## Problem
They need a landing page.

## Approach
We'll build a focused landing page.`,
      usage: { prompt_tokens: 100, completion_tokens: 200 },
    });

    await db.artifact.create({
      data: {
        leadId,
        type: "enrichment",
        title: "AI Enrichment Report",
        content: "{}",
        meta: {},
      },
    });

    const result = await runPositioning(leadId);

    expect(result.artifactId).toBeDefined();
    const artifact = await db.artifact.findFirst({
      where: { leadId, type: "positioning", title: "POSITIONING_BRIEF" },
    });
    expect(artifact).not.toBeNull();
    expect(artifact?.content).toContain("Problem");
  });

  it("works without enrichment artifact (uses fallback lead intelligence block)", async () => {
    const { chat } = await import("@/lib/llm");
    vi.mocked(chat).mockResolvedValue({
      content: `---METADATA---
{"feltProblem":"Need online presence","languageMap":{"use":["results"],"avoid":[],"competitorOveruse":[]},"reframedOffer":"Landing page","blueOceanAngle":"Focus on follow-up conversion","packaging":{"solutionName":"LP","doNotMention":[],"hookOneLiner":"Get more leads from your site"}}
---BRIEF---
Brief without enrichment.`,
      usage: { prompt_tokens: 80, completion_tokens: 50 },
    });

    const result = await runPositioning(leadId);

    expect(result.artifactId).toBeDefined();
    const artifact = await db.artifact.findFirst({
      where: { leadId, type: "positioning", title: "POSITIONING_BRIEF" },
    });
    expect(artifact).not.toBeNull();
  });

  it("throws when lead not found", async () => {
    await expect(runPositioning("clxxxxxxxxxxxxxxxxxxxxxxxxxx")).rejects.toThrow("Lead not found");
  });

  it("throws VALIDATION when meta JSON is invalid", async () => {
    const { chat } = await import("@/lib/llm");
    vi.mocked(chat).mockResolvedValue({
      content: `---METADATA---
{ invalid json }
---BRIEF---
Brief`,
      usage: { prompt_tokens: 50, completion_tokens: 20 },
    });

    await expect(runPositioning(leadId)).rejects.toThrow(/VALIDATION|parse/);
  });

  it("dry run creates placeholder artifact", async () => {
    process.env.PIPELINE_DRY_RUN = "1";

    const result = await runPositioning(leadId);

    expect(result.artifactId).toBeDefined();
    const artifact = await db.artifact.findFirst({
      where: { leadId, type: "positioning", title: "POSITIONING_BRIEF" },
    });
    expect(artifact?.content).toContain("DRY RUN");
  });
});
