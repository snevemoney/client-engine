/**
 * Purge ALL test/mock data from the dev database.
 * Run: npx tsx scripts/purge-test-data.ts
 *
 * This is a standalone script — no dependency on clean-demo-data.ts.
 * Deletes in dependency order to avoid FK constraint violations.
 * Cascade relations (NextActionExecution, NotificationDelivery) are handled
 * automatically by Prisma onDelete: Cascade.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function purge() {
  const counts: Record<string, number> = {};

  function log(model: string, count: number) {
    if (count > 0) {
      counts[model] = (counts[model] ?? 0) + count;
      console.log(`  ${model}: ${count} deleted`);
    }
  }

  console.log("Purging test/mock data...\n");

  // ── 1. Growth: Deal children → Deals → Prospects ──────────────
  const testProspects = await db.prospect.findMany({
    where: {
      OR: [
        { name: { contains: "Test Prospect" } },
        { name: { startsWith: "Golden Prospect" } },
        { handle: { startsWith: "schedule_test_" } },
        { handle: { startsWith: "draft_test_" } },
        { handle: { startsWith: "send_test_" } },
        { handle: { startsWith: "golden_" } },
      ],
    },
    select: { id: true },
  });

  if (testProspects.length > 0) {
    const prospectIds = testProspects.map((p) => p.id);
    const testDeals = await db.deal.findMany({
      where: { prospectId: { in: prospectIds } },
      select: { id: true },
    });
    const dealIds = testDeals.map((d) => d.id);

    if (dealIds.length > 0) {
      log("FollowUpSchedule", (await db.followUpSchedule.deleteMany({ where: { dealId: { in: dealIds } } })).count);
      log("OutreachEvent", (await db.outreachEvent.deleteMany({ where: { dealId: { in: dealIds } } })).count);
      log("OutreachMessage", (await db.outreachMessage.deleteMany({ where: { dealId: { in: dealIds } } })).count);
      log("DealEvent", (await db.dealEvent.deleteMany({ where: { dealId: { in: dealIds } } })).count);
      log("Deal", (await db.deal.deleteMany({ where: { id: { in: dealIds } } })).count);
    }

    log("Prospect", (await db.prospect.deleteMany({ where: { id: { in: prospectIds } } })).count);
  }

  // ── 2. Next Best Actions (cascade deletes NextActionExecution) ─
  log("NextBestAction", (await db.nextBestAction.deleteMany({
    where: {
      OR: [
        { createdByRule: { in: ["test", "test_pagination", "test_scope", "test_snooze", "test_delivery"] } },
        { title: { startsWith: "Test NBA" } },
        { title: { startsWith: "Test Execute" } },
        { title: { startsWith: "Test Patch" } },
        { title: { startsWith: "Golden " } },
        { title: { startsWith: "Schedule test" } },
        { title: { startsWith: "Mark replied test" } },
        { dedupeKey: { startsWith: "test_nba_" } },
        { dedupeKey: { startsWith: "test_patch_nba:" } },
        { dedupeKey: { startsWith: "test_delivery_" } },
        { dedupeKey: { contains: "golden_growth" } },
        { dedupeKey: { contains: "growth_integration" } },
        { dedupeKey: { in: [
          "nba:score_in_critical_band:command_center",
          "nba:failed_notification_deliveries:system",
          "nba:overdue_reminders_high_priority:system",
        ] } },
      ],
    },
  })).count);

  // ── 3. Next Action Runs ────────────────────────────────────────
  log("NextActionRun", (await db.nextActionRun.deleteMany({
    where: {
      OR: [
        { runKey: { startsWith: "nba:seed:" } },
        { runKey: { startsWith: "nba:test_" } },
      ],
    },
  })).count);

  // ── 4. Risk Flags ──────────────────────────────────────────────
  log("RiskFlag", (await db.riskFlag.deleteMany({
    where: {
      OR: [
        { dedupeKey: { startsWith: "sample:" } },
        { dedupeKey: { startsWith: "test_patch_risk:" } },
        { dedupeKey: { startsWith: "test_risk_" } },
        { createdByRule: { in: ["test", "test_pagination", "test_status_filter"] } },
        { title: "Patch Test" },
      ],
    },
  })).count);

  // ── 5. Score Snapshots ─────────────────────────────────────────
  log("ScoreSnapshot", (await db.scoreSnapshot.deleteMany({
    where: {
      OR: [
        { entityId: { startsWith: "test_" } },
        { entityId: { startsWith: "golden_" } },
        { AND: [{ entityId: "command_center" }, { band: "critical" }, { delta: -10 }] },
      ],
    },
  })).count);

  // ── 6. Notifications: deliveries cascade from events/channels ──
  // Delete events first (deliveries cascade), then channels
  const testEventIds = (await db.notificationEvent.findMany({
    where: {
      OR: [
        { eventKey: { in: ["test", "t"] } },
        { dedupeKey: { startsWith: "test:" } },
      ],
    },
    select: { id: true },
  })).map((e) => e.id);

  if (testEventIds.length > 0) {
    // Unlink InAppNotifications before deleting events (SetNull relation)
    log("InAppNotification (unlinked)", (await db.inAppNotification.updateMany({
      where: { notificationEventId: { in: testEventIds } },
      data: { notificationEventId: null },
    })).count);

    log("NotificationEvent", (await db.notificationEvent.deleteMany({
      where: { id: { in: testEventIds } },
    })).count);
  }

  log("NotificationChannel", (await db.notificationChannel.deleteMany({
    where: { key: { startsWith: "test_" } },
  })).count);

  // ── 7. Job Schedules ───────────────────────────────────────────
  log("JobSchedule", (await db.jobSchedule.deleteMany({
    where: { key: { startsWith: "test_" } },
  })).count);

  // ── 8. Signal Items ────────────────────────────────────────────
  log("SignalItem", (await db.signalItem.deleteMany({
    where: { title: { startsWith: "Mock:" } },
  })).count);

  // ── 9. Proof Records & Candidates ──────────────────────────────
  log("ProofRecord", (await db.proofRecord.deleteMany({
    where: { proofSnippet: { contains: "Sample", mode: "insensitive" } },
  })).count);

  // Unlink proof records from candidates before deleting candidates
  const testCandidates = await db.proofCandidate.findMany({
    where: {
      OR: [
        { proofSnippet: { contains: "Sample", mode: "insensitive" } },
        { proofSnippet: { contains: "Seeded", mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  if (testCandidates.length > 0) {
    const candidateIds = testCandidates.map((c) => c.id);
    await db.proofRecord.updateMany({
      where: { proofCandidateId: { in: candidateIds } },
      data: { proofCandidateId: null },
    });
    log("ProofCandidate", (await db.proofCandidate.deleteMany({
      where: { id: { in: candidateIds } },
    })).count);
  }

  // ── 10. Delivery Projects (children first) ─────────────────────
  const DEMO_DELIVERY_TITLES = [
    "In progress — due soon",
    "Overdue project",
    "Completed this week",
    "Completed, no proof candidate",
    "Blocked QA",
  ];
  const testDeliveries = await db.deliveryProject.findMany({
    where: { title: { in: DEMO_DELIVERY_TITLES } },
    select: { id: true },
  });
  for (const p of testDeliveries) {
    await db.deliveryActivity.deleteMany({ where: { deliveryProjectId: p.id } });
    await db.deliveryMilestone.deleteMany({ where: { deliveryProjectId: p.id } });
    await db.deliveryChecklistItem.deleteMany({ where: { deliveryProjectId: p.id } });
    await db.deliveryProject.delete({ where: { id: p.id } });
  }
  if (testDeliveries.length > 0) log("DeliveryProject", testDeliveries.length);

  // ── 11. Proposals ──────────────────────────────────────────────
  const DEMO_PROPOSAL_TITLES = [
    "Draft incomplete — funnel automation",
    "Ready not sent — ops audit",
    "Sent awaiting response",
    "Accepted — dental website",
    "Rejected proposal",
  ];
  const testProposals = await db.proposal.findMany({
    where: { title: { in: DEMO_PROPOSAL_TITLES } },
    select: { id: true },
  });
  for (const p of testProposals) {
    await db.proposalVersion.deleteMany({ where: { proposalId: p.id } });
    await db.proposalActivity.deleteMany({ where: { proposalId: p.id } });
    await db.proposal.delete({ where: { id: p.id } });
  }
  if (testProposals.length > 0) log("Proposal", testProposals.length);

  // ── 12. Intake Leads ───────────────────────────────────────────
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
  const testIntakes = await db.intakeLead.findMany({
    where: { title: { in: DEMO_INTAKE_TITLES } },
    select: { id: true, promotedLeadId: true },
  });
  const promotedLeadIds = testIntakes.map((i) => i.promotedLeadId).filter(Boolean) as string[];

  for (const i of testIntakes) {
    await db.intakeLead.update({ where: { id: i.id }, data: { promotedLeadId: null } }).catch(() => {});
    await db.leadActivity.deleteMany({ where: { intakeLeadId: i.id } });
    await db.proofRecord.updateMany({ where: { intakeLeadId: i.id }, data: { intakeLeadId: null } });
    await db.proofCandidate.updateMany({ where: { intakeLeadId: i.id }, data: { intakeLeadId: null } });
    await db.proposal.updateMany({ where: { intakeLeadId: i.id }, data: { intakeLeadId: null } });
    await db.deliveryProject.updateMany({ where: { intakeLeadId: i.id }, data: { intakeLeadId: null } });
  }
  log("IntakeLead", (await db.intakeLead.deleteMany({ where: { title: { in: DEMO_INTAKE_TITLES } } })).count);

  // ── 13. Pipeline Leads (last — most referenced) ────────────────
  const testLeads = await db.lead.findMany({
    where: {
      OR: [
        { id: { in: promotedLeadIds } },
        { source: "e2e" },
        { title: { startsWith: "E2E test lead" } },
        { title: { startsWith: "E2E Trust-to-close lead" } },
        { title: { contains: "Smoke Test", mode: "insensitive" } },
        { title: { contains: "Prod Test", mode: "insensitive" } },
        { title: { contains: "QA Test", mode: "insensitive" } },
        { title: { contains: "Final Prod Check", mode: "insensitive" } },
        { title: { contains: "Post-env-deploy test", mode: "insensitive" } },
        { title: { in: ["Test", "Research Lead 001"] } },
        { title: { contains: "DROP TABLE", mode: "insensitive" } },
        { title: { contains: "<script>", mode: "insensitive" } },
        // Demo seed leads
        { title: { in: [
          "Need funnel automation for coaching business",
          "Operations audit and tool consolidation",
          "Website rebuild + AI chat widget",
          "Ads management and funnel optimization",
          "RSS-scraped opportunity",
        ] } },
      ],
      project: null, // Only leads without a project (test/demo leads)
    },
    select: { id: true },
  });

  for (const lead of testLeads) {
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
  }
  if (testLeads.length > 0) log("Lead", testLeads.length);

  // ── Summary ────────────────────────────────────────────────────
  const total = Object.values(counts).reduce((s, c) => s + c, 0);
  console.log(`\nDone. Purged ${total} test/mock records across ${Object.keys(counts).length} models.`);
}

purge()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
