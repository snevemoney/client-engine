/**
 * Contract test for pipeline score: ensures dry-run path uses Prisma-compatible
 * payload (scoreFactors: Prisma.DbNull, not raw null) so types don't drift.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "@/lib/db";
import { runScore } from "./score";

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
