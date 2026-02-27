/**
 * Re-score ALL leads with the current scoring logic.
 * Run with: PIPELINE_DRY_RUN=0 npx tsx scripts/rescore-all-leads.ts
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

  const leads = await db.lead.findMany({
    select: { id: true, title: true },
    orderBy: { createdAt: "desc" },
  });

  if (leads.length === 0) {
    console.log("No leads found.");
    process.exit(0);
  }

  console.log(`Re-scoring ALL ${leads.length} lead(s)...`);

  let ok = 0;
  let fail = 0;

  for (const lead of leads) {
    try {
      await runScore(lead.id);
      console.log(`  ✓ ${lead.title.slice(0, 60)}...`);
      ok++;
    } catch (err) {
      console.error(`  ✗ ${lead.title.slice(0, 60)}... - ${err instanceof Error ? err.message : String(err)}`);
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
