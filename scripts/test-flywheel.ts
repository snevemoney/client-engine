/**
 * Test the full flywheel end-to-end with fake prospect data.
 *
 * Run: npx tsx scripts/test-flywheel.ts
 *
 * This exercises the complete pipeline:
 *   Prospect → Lead → Pipeline → Proposal → Send → Accept → Delivery → Builder
 *
 * Uses a fake prospect (no real deals). Builder step will fail gracefully
 * if the builder service isn't running — that's expected.
 */
import { runFlywheel } from "../src/lib/orchestrator/flywheel";

const FAKE_PROSPECT = {
  title: "Sarah Mitchell — Health Coach (Instagram, no website)",
  source: "instagram",
  sourceUrl: "https://instagram.com/sarahmitchellcoaching",
  description:
    "Health & wellness coach specializing in gut health and anti-inflammatory nutrition. " +
    "Active on Instagram with 12k followers. No website, no booking system, no client portal. " +
    "Uses Linktree with only an email link. High opportunity — needs full digital presence.",
  contactName: "Sarah Mitchell",
  contactEmail: "sarah@example-test.com",
  company: "Sarah Mitchell Coaching",
  budget: "$3,000-$5,000",
  timeline: "2-3 weeks",
  tags: ["health_coaching", "no_website", "instagram", "flywheel_test"],
  builderPreset: "health_coaching" as const,
  builderScope: ["homepage", "about", "services", "booking", "testimonials"],
  contentHints:
    "Gut health specialist. Anti-inflammatory nutrition coach. " +
    "12k Instagram followers. No website. Needs booking system, client portal, " +
    "testimonial showcase. Target audience: women 30-55.",
};

async function main() {
  console.log("╔════════════════════════════════════════════════╗");
  console.log("║  FLYWHEEL TEST — Full Agentic Pipeline        ║");
  console.log("╚════════════════════════════════════════════════╝\n");
  console.log(`Prospect: ${FAKE_PROSPECT.title}`);
  console.log(`Source: ${FAKE_PROSPECT.source}`);
  console.log(`Budget: ${FAKE_PROSPECT.budget}\n`);
  console.log("Running flywheel...\n");

  const result = await runFlywheel(FAKE_PROSPECT);

  console.log("─── Steps ───────────────────────────────────────\n");
  for (const step of result.steps) {
    const icon = step.status === "ok" ? "✓" : step.status === "skipped" ? "–" : "✗";
    const color = step.status === "ok" ? "\x1b[32m" : step.status === "error" ? "\x1b[31m" : "\x1b[33m";
    console.log(`  ${color}${icon}\x1b[0m [${step.durationMs}ms] ${step.step}: ${step.detail}`);
    if (step.entityId) console.log(`      → ID: ${step.entityId}`);
  }

  console.log("\n─── Result ──────────────────────────────────────\n");
  console.log(`  OK:                 ${result.ok}`);
  console.log(`  Lead ID:            ${result.leadId ?? "(none)"}`);
  console.log(`  Proposal ID:        ${result.proposalId ?? "(none)"}`);
  console.log(`  Delivery Project:   ${result.deliveryProjectId ?? "(none)"}`);
  console.log(`  Builder Site:       ${result.builderSiteId ?? "(none)"}`);
  console.log(`  Total Duration:     ${result.totalDurationMs}ms`);

  console.log("\n─── Verification ────────────────────────────────\n");

  // Verify entities exist in DB
  const { db } = await import("../src/lib/db");

  if (result.leadId) {
    const lead = await db.lead.findUnique({
      where: { id: result.leadId },
      include: { artifacts: { select: { type: true, title: true } } },
    });
    console.log(`  Lead status:        ${lead?.status}`);
    console.log(`  Lead artifacts:     ${lead?.artifacts.map((a) => a.type).join(", ") || "(none)"}`);
    console.log(`  Proposal count:     ${lead?.proposalCount}`);
  }

  if (result.proposalId) {
    const proposal = await db.proposal.findUnique({ where: { id: result.proposalId } });
    console.log(`  Proposal status:    ${proposal?.status}`);
    console.log(`  Proposal sent at:   ${proposal?.sentAt?.toISOString() ?? "(not sent)"}`);
    console.log(`  Proposal accepted:  ${proposal?.acceptedAt?.toISOString() ?? "(not accepted)"}`);
  }

  if (result.deliveryProjectId) {
    const project = await db.deliveryProject.findUnique({
      where: { id: result.deliveryProjectId },
      include: {
        milestones: { select: { title: true, status: true } },
        checklistItems: { select: { label: true, isDone: true } },
      },
    });
    console.log(`  Project status:     ${project?.status}`);
    console.log(`  Builder site ID:    ${project?.builderSiteId ?? "(none)"}`);
    console.log(`  Builder preview:    ${project?.builderPreviewUrl ?? "(none)"}`);
    console.log(`  Builder preset:     ${project?.builderPreset ?? "(none)"}`);
    console.log(`  Milestones:         ${project?.milestones.map((m) => m.title).join(", ")}`);
    console.log(`  Checklist items:    ${project?.checklistItems.length}`);
  }

  console.log("\n═════════════════════════════════════════════════\n");

  await db.$disconnect();
  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
