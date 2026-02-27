/**
 * Re-score leads that have the dry-run placeholder score (50).
 * Run with: PIPELINE_DRY_RUN=0 npx tsx scripts/rescore-placeholder-leads.ts
 * Requires OPENAI_API_KEY and PIPELINE_DRY_RUN=0 for real LLM scoring.
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { runScore } from "../src/lib/pipeline/score";

async function main() {
  if (process.env.PIPELINE_DRY_RUN === "1" || process.env.E2E_MODE === "1") {
    console.error("Set PIPELINE_DRY_RUN=0 and ensure OPENAI_API_KEY is set for real scoring.");
    process.exit(1);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY not set. Real scoring requires an OpenAI key.");
    process.exit(1);
  }

  const placeholderLeads = await db.lead.findMany({
    where: {
      score: 50,
      scoreReason: { contains: "DRY RUN", mode: "insensitive" },
    },
    select: { id: true, title: true },
  });

  if (placeholderLeads.length === 0) {
    console.log("No leads with placeholder score found.");
    process.exit(0);
  }

  console.log(`Re-scoring ${placeholderLeads.length} lead(s) with placeholder score 50...`);

  let ok = 0;
  let fail = 0;

  for (const lead of placeholderLeads) {
    try {
      await runScore(lead.id);
      console.log(`  ✓ ${lead.title.slice(0, 50)}...`);
      ok++;
    } catch (err) {
      console.error(`  ✗ ${lead.title.slice(0, 50)}... - ${err instanceof Error ? err.message : String(err)}`);
      fail++;
    }
  }

  console.log(`\nDone. ${ok} rescored, ${fail} failed.`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
