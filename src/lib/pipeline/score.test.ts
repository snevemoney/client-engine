/**
 * Contract test for pipeline score: ensures dry-run path uses Prisma-compatible
 * payload (scoreFactors: Prisma.DbNull, not raw null) so types don't drift.
 * Extended tests with mocked LLM verify clamping, verdict validation, malformed input.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db } from "@/lib/db";
import { runScore } from "./score";
import { chat } from "@/lib/llm";

vi.mock("@/lib/llm", () => ({
  chat: vi.fn(),
}));

vi.mock("@/lib/ops/settings", () => ({
  getOperatorSettings: vi.fn().mockResolvedValue({}),
}));

const TEST_LEAD_PREFIX = "pipeline-score-contract-";

describe("runScore (pipeline score contract)", () => {
  let leadId: string;
  let originalDryRun: string | undefined;

  beforeEach(async () => {
    originalDryRun = process.env.PIPELINE_DRY_RUN;
    process.env.PIPELINE_DRY_RUN = "1";

    const lead = await db.lead.create({
      data: {
        title: `${TEST_LEAD_PREFIX} ${Date.now()}`,
        source: "test",
        status: "NEW",
        techStack: [],
        tags: [],
      },
    });
    leadId = lead.id;
  });

  afterEach(async () => {
    process.env.PIPELINE_DRY_RUN = originalDryRun;
    if (leadId) {
      await db.lead.delete({ where: { id: leadId } }).catch(() => {});
    }
  });

  it("dry-run updates lead with Prisma-compatible score payload (scoreFactors uses DbNull)", async () => {
    await runScore(leadId);

    const updated = await db.lead.findUnique({ where: { id: leadId } });
    expect(updated).not.toBeNull();
    expect(updated?.score).toBe(50);
    expect(updated?.scoreReason).toContain("[DRY RUN]");
    expect(updated?.scoreVerdict).toBeNull();
    // scoreFactors stored as DbNull comes back as null from Prisma
    expect(updated?.scoreFactors).toBeNull();
    expect(updated?.scoredAt).toBeInstanceOf(Date);
  });
});

describe("runScore with mocked LLM", () => {
  let leadId: string;
  let originalDryRun: string | undefined;

  beforeEach(async () => {
    originalDryRun = process.env.PIPELINE_DRY_RUN;
    process.env.PIPELINE_DRY_RUN = "0";

    const lead = await db.lead.create({
      data: {
        title: `${TEST_LEAD_PREFIX} mocked-${Date.now()}`,
        source: "manual",
        status: "NEW",
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
      await db.lead.delete({ where: { id: leadId } }).catch(() => {});
    }
  });

  it("clamps score above 100 to 100", async () => {
    vi.mocked(chat).mockResolvedValue({
      content: JSON.stringify({
        score: 150,
        verdict: "ACCEPT",
        factors: {},
        reasons: ["High intent"],
        suggestion: "Follow up",
      }),
      usage: { prompt_tokens: 10, completion_tokens: 20 },
    });

    await runScore(leadId);

    const updated = await db.lead.findUnique({ where: { id: leadId } });
    expect(updated?.score).toBe(100);
    expect(updated?.scoreVerdict).toBe("ACCEPT");
  });

  it("clamps score below 0 to 0", async () => {
    vi.mocked(chat).mockResolvedValue({
      content: JSON.stringify({
        score: -5,
        verdict: "REJECT",
        factors: {},
        reasons: ["Bad fit"],
        suggestion: "Skip",
      }),
      usage: { prompt_tokens: 10, completion_tokens: 20 },
    });

    await runScore(leadId);

    const updated = await db.lead.findUnique({ where: { id: leadId } });
    expect(updated?.score).toBe(0);
    expect(updated?.scoreVerdict).toBe("REJECT");
  });

  it("sets verdict to null for unexpected value", async () => {
    vi.mocked(chat).mockResolvedValue({
      content: JSON.stringify({
        score: 72,
        verdict: "INVALID_VERDICT",
        factors: {},
        reasons: ["Unclear"],
        suggestion: "Review",
      }),
      usage: { prompt_tokens: 10, completion_tokens: 20 },
    });

    await runScore(leadId);

    const updated = await db.lead.findUnique({ where: { id: leadId } });
    expect(updated?.score).toBe(72);
    expect(updated?.scoreVerdict).toBeNull();
  });

  it("handles non-numeric score with parseInt fallback to 50", async () => {
    vi.mocked(chat).mockResolvedValue({
      content: JSON.stringify({
        score: "not-a-number",
        verdict: "MAYBE",
        factors: {},
        reasons: ["Unclear"],
        suggestion: "Review",
      }),
      usage: { prompt_tokens: 10, completion_tokens: 20 },
    });

    await runScore(leadId);

    const updated = await db.lead.findUnique({ where: { id: leadId } });
    expect(updated?.score).toBe(50);
    expect(updated?.scoreVerdict).toBe("MAYBE");
  });

  it("stores float score correctly (72.5 clamped to 72)", async () => {
    vi.mocked(chat).mockResolvedValue({
      content: JSON.stringify({
        score: 72.5,
        verdict: "ACCEPT",
        factors: {},
        reasons: ["Good fit"],
        suggestion: "Proceed",
      }),
      usage: { prompt_tokens: 10, completion_tokens: 20 },
    });

    await runScore(leadId);

    const updated = await db.lead.findUnique({ where: { id: leadId } });
    expect(updated?.score).toBe(72);
    expect(updated?.scoreVerdict).toBe("ACCEPT");
  });
});
