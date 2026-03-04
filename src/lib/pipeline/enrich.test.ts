/**
 * Unit tests for pipeline enrich step.
 * Mocks LLM to verify: valid response, malformed JSON, missing fields.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db } from "@/lib/db";
import { runEnrich } from "./enrich";
import { chat } from "@/lib/llm";

vi.mock("@/lib/llm", () => ({
  chat: vi.fn(),
}));

const TEST_LEAD_PREFIX = "pipeline-enrich-test-";

const validEnrichmentResponse = {
  budget: "$5,000",
  timeline: "2-3 weeks",
  platform: "web",
  techStack: ["Next.js", "React"],
  requirements: ["Landing page", "Contact form", "SEO"],
  riskFlags: [],
  category: "landing-page",
  adoptionRisk: { level: "low", reasons: [], trustFriction: [] },
  toolLoyaltyRisk: { level: "low", currentTools: [], lockInConcerns: [] },
  reversibility: { strategy: "phased", pilotFirst: true },
  stakeholderMap: [],
};

describe("runEnrich with mocked LLM", () => {
  let leadId: string;
  let originalDryRun: string | undefined;

  beforeEach(async () => {
    originalDryRun = process.env.PIPELINE_DRY_RUN;
    process.env.PIPELINE_DRY_RUN = "0";

    const lead = await db.lead.create({
      data: {
        title: `${TEST_LEAD_PREFIX} ${Date.now()}`,
        source: "test",
        status: "NEW",
        description: "Need a landing page",
        techStack: [],
        tags: [],
      },
    });
    leadId = lead.id;
  });

  afterEach(async () => {
    process.env.PIPELINE_DRY_RUN = originalDryRun;
    vi.restoreAllMocks();
    if (leadId) {
      await db.artifact.deleteMany({ where: { leadId } });
      await db.lead.delete({ where: { id: leadId } }).catch(() => {});
    }
  });

  it("valid LLM response creates artifact and updates lead", async () => {
    vi.mocked(chat).mockResolvedValue({
      content: JSON.stringify(validEnrichmentResponse),
      usage: { prompt_tokens: 100, completion_tokens: 200 },
    });

    const result = await runEnrich(leadId);

    expect(result.artifactId).toBeDefined();

    const updated = await db.lead.findUnique({ where: { id: leadId } });
    expect(updated?.status).toBe("ENRICHED");
    expect(updated?.budget).toBe("$5,000");
    expect(updated?.timeline).toBe("2-3 weeks");
    expect(updated?.platform).toBe("web");
    expect(updated?.enrichedAt).toBeInstanceOf(Date);

    const artifact = await db.artifact.findFirst({
      where: { leadId, type: "enrichment", title: "AI Enrichment Report" },
    });
    expect(artifact).not.toBeNull();
    expect(artifact?.content).toContain("$5,000");
    expect(artifact?.content).toContain("Next.js");
  });

  it("malformed JSON propagates error from safeParseJSON", async () => {
    vi.mocked(chat).mockResolvedValue({
      content: "not valid json {",
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    });

    await expect(runEnrich(leadId)).rejects.toThrow(/Invalid JSON/);

    const updated = await db.lead.findUnique({ where: { id: leadId } });
    expect(updated?.status).toBe("NEW");
    expect(updated?.enrichedAt).toBeNull();
  });

  it("missing fields use lead fallbacks for partial data", async () => {
    vi.mocked(chat).mockResolvedValue({
      content: JSON.stringify({
        category: "other",
        adoptionRisk: { level: "unknown", reasons: [] },
        toolLoyaltyRisk: { level: "unknown" },
        reversibility: { strategy: "" },
        stakeholderMap: [],
      }),
      usage: { prompt_tokens: 80, completion_tokens: 60 },
    });

    const result = await runEnrich(leadId);

    expect(result.artifactId).toBeDefined();

    const updated = await db.lead.findUnique({ where: { id: leadId } });
    expect(updated?.status).toBe("ENRICHED");
    expect(updated?.enrichedAt).toBeInstanceOf(Date);
  });
});
