/**
 * Test enrichSiteBrief in dev — runs the LLM enrichment and logs output.
 *
 * Run: npx tsx scripts/test-enrich-site-brief.ts [deliveryProjectId]
 *
 * If no ID provided, uses the first delivery project with a pipeline lead.
 */
import { db } from "../src/lib/db";
import { enrichSiteBrief, packContentHintsForBuilder } from "../src/lib/builder/enrich-site-brief";

async function main() {
  const id = process.argv[2];
  let projectId: string;

  if (id) {
    const p = await db.deliveryProject.findUnique({ where: { id }, select: { id: true } });
    if (!p) {
      console.error("Delivery project not found:", id);
      process.exit(1);
    }
    projectId = p.id;
  } else {
    const p = await db.deliveryProject.findFirst({
      where: { pipelineLeadId: { not: null } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true },
    });
    if (!p) {
      console.error("No delivery project with pipeline lead found.");
      process.exit(1);
    }
    projectId = p.id;
    console.log(`Using project: ${p.title} (${p.id})\n`);
  }

  console.log("Running enrichSiteBrief...\n");
  const start = Date.now();
  const enrichment = await enrichSiteBrief(projectId);
  const elapsed = Date.now() - start;

  if (!enrichment) {
    console.log("enrichSiteBrief returned null (LLM or parse failed). Fallback would be used.\n");
    process.exit(0);
  }

  console.log(`✓ Enrichment completed in ${elapsed}ms\n`);
  console.log("─── Output ─────────────────────────────────────\n");
  console.log("scope:", JSON.stringify(enrichment.scope, null, 2));
  console.log("\nbrandColors:", JSON.stringify(enrichment.brandColors, null, 2));
  console.log("\ncontentHints (first 500 chars):", (enrichment.contentHints ?? "").slice(0, 500));
  console.log("\nclientInfo:", JSON.stringify(enrichment.clientInfo, null, 2));

  const packed = packContentHintsForBuilder(enrichment.contentHints, enrichment.clientInfo);
  console.log("\n─── Packed contentHints for builder ─────────────\n");
  console.log(packed.slice(0, 800));
  console.log("\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
