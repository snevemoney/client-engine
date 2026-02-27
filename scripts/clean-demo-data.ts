/**
 * Remove demo/test data created by seed scripts and E2E/smoke tests.
 * Run: npx tsx scripts/clean-demo-data.ts
 *
 * Deletes records matching known demo titles/patterns from:
 * - Lead (pipeline): E2E test leads, Smoke Test, Research Lead 001, Prod Test, QA Test,
 *   Final Prod Check, Post-env-deploy test, SQL/XSS test payloads, system leads (optional)
 * - IntakeLead, Proposal, DeliveryProject
 * - ProofRecord, ProofCandidate
 * - RiskFlag (sample:*), NextBestAction (seed), NextActionRun (nba:seed)
 *
 * Pass CLEAN_INCLUDE_SYSTEM_LEADS=1 to also remove "Learning Engine Runs" and "Research Engine Runs"
 * (they store workday/research reports and will be recreated when those engines run).
 *
 * Requires NODE_ENV=development, SEED_DEMO_DATA=1, or CLEAN_DEMO_ALLOW_PROD=1 (for production).
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function canRun(): boolean {
  if (process.env.CLEAN_DEMO_ALLOW_PROD === "1" || process.env.CLEAN_DEMO_ALLOW_PROD === "true") return true;
  const env = process.env.NODE_ENV;
  const explicit = process.env.SEED_DEMO_DATA === "1" || process.env.SEED_DEMO_DATA === "true";
  return env === "development" || explicit;
}

const DEMO_INTAKE_TITLES = [
  "Need funnel automation for coaching business",
  "Operations audit and tool consolidation",
  "Website rebuild + AI chat widget",
  "Ads management and funnel optimization",
  "RSS-scraped opportunity",
  "Overdue follow-up (seed)",
  "Due today (seed)",
  "Upcoming in 3 days (seed)",
  "Won lead (excluded)",
  "Lost lead (excluded)",
  "Promoted lead with follow-up (seed)",
  "Prod Test",
  "QA Test",
  "Final Prod Check",
  "Post-env-deploy test",
  "Test",
  "Robert'; DROP TABLE leads;--",
  "<script>alert(1)</script>",
];

const DEMO_PROPOSAL_TITLES = [
  "Draft incomplete — funnel automation",
  "Ready not sent — ops audit",
  "Sent awaiting response",
  "Accepted — dental website",
  "Rejected proposal",
];

const DEMO_DELIVERY_TITLES = [
  "In progress — due soon",
  "Overdue project",
  "Completed this week",
  "Completed, no proof candidate",
  "Blocked QA",
];

async function main() {
  if (!canRun()) {
    console.error("clean-demo-data requires NODE_ENV=development, SEED_DEMO_DATA=1, or CLEAN_DEMO_ALLOW_PROD=1.");
    process.exit(1);
  }

  let deleted = 0;

  // 1. Delivery projects (and their checklist/milestones/activity via cascade or manual)
  const deliveryProjects = await db.deliveryProject.findMany({
    where: { title: { in: DEMO_DELIVERY_TITLES } },
    select: { id: true },
  });
  for (const p of deliveryProjects) {
    await db.deliveryActivity.deleteMany({ where: { deliveryProjectId: p.id } });
    await db.deliveryMilestone.deleteMany({ where: { deliveryProjectId: p.id } });
    await db.deliveryChecklistItem.deleteMany({ where: { deliveryProjectId: p.id } });
    await db.deliveryProject.delete({ where: { id: p.id } });
    deleted++;
  }
  if (deliveryProjects.length > 0) console.log(`Deleted ${deliveryProjects.length} demo delivery projects`);

  // 2. Proposals (versions and activity cascade)
  const proposals = await db.proposal.findMany({
    where: { title: { in: DEMO_PROPOSAL_TITLES } },
    select: { id: true },
  });
  for (const p of proposals) {
    await db.proposalVersion.deleteMany({ where: { proposalId: p.id } });
    await db.proposalActivity.deleteMany({ where: { proposalId: p.id } });
    await db.proposal.delete({ where: { id: p.id } });
    deleted++;
  }
  if (proposals.length > 0) console.log(`Deleted ${proposals.length} demo proposals`);

  // 3. Proof records and candidates linked to demo intake leads (by proofSnippet containing "Sample")
  const proofRecords = await db.proofRecord.findMany({
    where: { proofSnippet: { contains: "Sample", mode: "insensitive" } },
    select: { id: true },
  });
  for (const r of proofRecords) {
    await db.proofRecord.delete({ where: { id: r.id } });
    deleted++;
  }
  const proofCandidates = await db.proofCandidate.findMany({
    where: {
      OR: [
        { proofSnippet: { contains: "Sample", mode: "insensitive" } },
        { proofSnippet: { contains: "Seeded", mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  for (const c of proofCandidates) {
    await db.proofRecord.updateMany({ where: { proofCandidateId: c.id }, data: { proofCandidateId: null } });
    await db.proofCandidate.delete({ where: { id: c.id } });
    deleted++;
  }
  if (proofRecords.length > 0 || proofCandidates.length > 0) {
    console.log(`Deleted ${proofRecords.length} proof records, ${proofCandidates.length} proof candidates`);
  }

  // 4. Intake leads: first unhook promotedLeadId, then delete
  const demoIntakes = await db.intakeLead.findMany({
    where: { title: { in: DEMO_INTAKE_TITLES } },
    select: { id: true, promotedLeadId: true },
  });
  const promotedLeadIds = demoIntakes.map((i) => i.promotedLeadId).filter(Boolean) as string[];

  for (const i of demoIntakes) {
    await db.intakeLead.update({ where: { id: i.id }, data: { promotedLeadId: null } });
    await db.leadActivity.deleteMany({ where: { intakeLeadId: i.id } });
    await db.proofRecord.updateMany({ where: { intakeLeadId: i.id }, data: { intakeLeadId: null } });
    await db.proofCandidate.updateMany({ where: { intakeLeadId: i.id }, data: { intakeLeadId: null } });
    await db.proposal.updateMany({ where: { intakeLeadId: i.id }, data: { intakeLeadId: null } });
    await db.deliveryProject.updateMany({ where: { intakeLeadId: i.id }, data: { intakeLeadId: null } });
  }
  await db.intakeLead.deleteMany({ where: { title: { in: DEMO_INTAKE_TITLES } } });
  deleted += demoIntakes.length;
  if (demoIntakes.length > 0) console.log(`Deleted ${demoIntakes.length} demo intake leads`);

  // 5. Pipeline leads: demo seeds + E2E/smoke test leads
  const includeSystem = process.env.CLEAN_INCLUDE_SYSTEM_LEADS === "1" || process.env.CLEAN_INCLUDE_SYSTEM_LEADS === "true";
  const demoLeadTitles = [
    "Need funnel automation for coaching business",
    "Operations audit and tool consolidation",
    "Website rebuild + AI chat widget",
    "Ads management and funnel optimization",
    "RSS-scraped opportunity",
  ];
  const testLeadPatterns = [
    { id: { in: promotedLeadIds } },
    { title: { in: demoLeadTitles } },
    { source: "e2e" },
    { title: { startsWith: "E2E test lead" } },
    { title: { startsWith: "E2E Trust-to-close lead" } },
    { title: { contains: "Smoke Test", mode: "insensitive" } },
    { title: "Research Lead 001" },
    { title: { contains: "Prod Test", mode: "insensitive" } },
    { title: { contains: "Final Prod Check", mode: "insensitive" } },
    { title: { contains: "Post-env-deploy test", mode: "insensitive" } },
    { title: { contains: "QA Test", mode: "insensitive" } },
    { title: { contains: "DROP TABLE", mode: "insensitive" } },
    { title: { contains: "<script>", mode: "insensitive" } },
    ...(includeSystem
      ? [{ source: "system" as const, title: "Learning Engine Runs" }, { source: "system" as const, title: "Research Engine Runs" }]
      : []),
  ];
  const e2eTestLeads = await db.lead.findMany({
    where: { OR: testLeadPatterns, project: null },
    select: { id: true },
  });
  const pipelineLeadsToDelete = e2eTestLeads;
  for (const lead of pipelineLeadsToDelete) {
    await db.intakeLead.updateMany({ where: { promotedLeadId: lead.id }, data: { promotedLeadId: null } });
    await db.artifact.deleteMany({ where: { leadId: lead.id } });
    await db.leadTouch.deleteMany({ where: { leadId: lead.id } });
    await db.leadReferral.deleteMany({ where: { sourceLeadId: lead.id } });
    await db.leadAttribution.deleteMany({ where: { leadId: lead.id } });
    await db.buildTask.updateMany({ where: { linkedLeadId: lead.id }, data: { linkedLeadId: null } });
    await db.proposal.updateMany({ where: { pipelineLeadId: lead.id }, data: { pipelineLeadId: null } });
    await db.deliveryProject.updateMany({ where: { pipelineLeadId: lead.id }, data: { pipelineLeadId: null } });
    await db.proofCandidate.updateMany({ where: { leadId: lead.id }, data: { leadId: null } });
    await db.lead.delete({ where: { id: lead.id } });
    deleted++;
  }
  if (pipelineLeadsToDelete.length > 0) console.log(`Deleted ${pipelineLeadsToDelete.length} demo pipeline leads`);

  // 6. Risk flags (sample:*)
  const riskResult = await db.riskFlag.deleteMany({ where: { dedupeKey: { startsWith: "sample:" } } });
  if (riskResult.count > 0) console.log(`Deleted ${riskResult.count} sample risk flags`);
  deleted += riskResult.count;

  // 7. Next best actions (seed dedupeKeys)
  const nbaDedupeKeys = [
    "nba:score_in_critical_band:command_center",
    "nba:failed_notification_deliveries:system",
    "nba:overdue_reminders_high_priority:system",
  ];
  const nbaResult = await db.nextBestAction.deleteMany({ where: { dedupeKey: { in: nbaDedupeKeys } } });
  if (nbaResult.count > 0) console.log(`Deleted ${nbaResult.count} sample next best actions`);
  deleted += nbaResult.count;

  // 8. NextActionRun (nba:seed:*)
  const runKeys = await db.nextActionRun.findMany({
    where: { runKey: { startsWith: "nba:seed:" } },
    select: { runKey: true },
  });
  const runResult = await db.nextActionRun.deleteMany({ where: { runKey: { startsWith: "nba:seed:" } } });
  if (runResult.count > 0) console.log(`Deleted ${runResult.count} seed next action runs`);
  deleted += runResult.count;

  // 9. SignalItem with Mock: in title (from rss-sync mock)
  const signalResult = await db.signalItem.deleteMany({ where: { title: { startsWith: "Mock:" } } });
  if (signalResult.count > 0) console.log(`Deleted ${signalResult.count} mock signal items`);
  deleted += signalResult.count;

  console.log(`Done. Removed demo/test data.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
