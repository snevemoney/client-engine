import { db } from "@/lib/db";
import type { WebResearchMode, WebResearchResult } from "./types";

/**
 * Generate a placeholder web research artifact when isDryRun() is true.
 * Follows the pattern from src/lib/pipeline/dry-run.ts.
 */
export async function dryRunWebResearch(
  leadId: string | undefined,
  mode: WebResearchMode,
): Promise<WebResearchResult> {
  const content = `**[DRY RUN]** Placeholder web research brief (${mode} mode). Set PIPELINE_DRY_RUN=0 for real research.`;

  let artifactId: string | undefined;

  if (leadId) {
    const artifact = await db.artifact.create({
      data: {
        leadId,
        type: "research",
        title: "WEB_RESEARCH_BRIEF",
        content,
        meta: {
          mode,
          provenance: {
            isDryRun: true,
            createdBy: "web-research",
            stepName: "web-research",
          },
        },
      },
    });
    artifactId = artifact.id;
  }

  return {
    ok: true,
    artifactId,
    mode,
    sourcesScraped: 0,
    totalTokensUsed: 0,
    costEstimate: 0,
    durationMs: 0,
    errors: [],
    content,
  };
}
