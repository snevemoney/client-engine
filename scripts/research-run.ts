/**
 * CLI entrypoint for research ingest. Run from cron or manually.
 * Loads .env via dotenv, then runs one cycle of runResearchDiscoverAndPipeline.
 *
 * Usage: npm run research:run
 * Env: RESEARCH_ENABLED=1, RESEARCH_FEED_URL=..., RESEARCH_LIMIT_PER_RUN=10, DATABASE_URL=...
 */
import "dotenv/config";
import { runResearchDiscoverAndPipeline } from "../src/lib/research/run";

async function main() {
  const limit = process.env.RESEARCH_LIMIT_PER_RUN
    ? Math.min(parseInt(process.env.RESEARCH_LIMIT_PER_RUN, 10) || 10, 50)
    : undefined;
  const report = await runResearchDiscoverAndPipeline({ limit });
  console.log(JSON.stringify(report));
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: String(err), at: new Date().toISOString() }));
  process.exit(1);
});
