/**
 * Seed sample ProofCandidates for dev/demo.
 * Run: npm run db:seed-proof-candidates
 * Requires IntakeLeads (run db:seed-intake-leads first).
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const intakeLeads = await db.intakeLead.findMany({ take: 4, orderBy: { createdAt: "desc" } });
  if (intakeLeads.length === 0) {
    console.log("No intake leads found. Run db:seed-intake-leads first.");
    return;
  }

  let created = 0;

  if (intakeLeads[0]) {
    await db.proofCandidate.create({
      data: {
        sourceType: "intake_lead",
        sourceId: intakeLeads[0].id,
        intakeLeadId: intakeLeads[0].id,
        title: `Delivery proof — ${intakeLeads[0].title || "Untitled"}`,
        company: intakeLeads[0].company ?? null,
        triggerType: "github",
        githubUrl: "https://github.com/example/repo/pull/1",
        proofSnippet: `Delivered work for ${intakeLeads[0].company || "client"}. Sample PR merged.`,
        status: "draft",
      },
    });
    created++;
  }

  if (intakeLeads[1]) {
    await db.proofCandidate.create({
      data: {
        sourceType: "intake_lead",
        sourceId: intakeLeads[1].id,
        intakeLeadId: intakeLeads[1].id,
        title: `Delivery proof — ${intakeLeads[1].title || "Untitled"}`,
        company: intakeLeads[1].company ?? null,
        triggerType: "loom",
        loomUrl: "https://www.loom.com/share/abc123",
        proofSnippet: `Delivered work for ${intakeLeads[1].company || "client"}. Walkthrough recorded.`,
        afterState: "Feature shipped",
        status: "ready",
        readyAt: new Date(),
      },
    });
    created++;
  }

  if (intakeLeads[2]) {
    await db.proofCandidate.create({
      data: {
        sourceType: "intake_lead",
        sourceId: intakeLeads[2].id,
        intakeLeadId: intakeLeads[2].id,
        title: `Delivery proof — ${intakeLeads[2].title || "Untitled"}`,
        company: intakeLeads[2].company ?? null,
        triggerType: "manual",
        deliverySummary: "Built dashboard and reports",
        proofSnippet: `Delivered work for ${intakeLeads[2].company || "client"}. Built dashboard and reports.`,
        status: "draft",
      },
    });
    created++;
  }

  if (intakeLeads[3]) {
    const promoted = await db.proofCandidate.create({
      data: {
        sourceType: "intake_lead",
        sourceId: intakeLeads[3].id,
        intakeLeadId: intakeLeads[3].id,
        title: `Delivery proof — ${intakeLeads[3].title || "Untitled"}`,
        company: intakeLeads[3].company ?? null,
        triggerType: "manual",
        proofSnippet: `Delivered work for ${intakeLeads[3].company || "client"}. Delivery completed.`,
        afterState: "Shipped",
        status: "ready",
        readyAt: new Date(),
      },
    });

    const existingRecord = await db.proofRecord.findFirst({
      where: { proofCandidateId: promoted.id },
    });

    if (!existingRecord) {
      const record = await db.proofRecord.create({
        data: {
          sourceType: "intake_lead",
          sourceId: intakeLeads[3].id,
          intakeLeadId: intakeLeads[3].id,
          proofCandidateId: promoted.id,
          title: promoted.title,
          company: promoted.company ?? undefined,
          outcome: "won",
          proofSnippet: promoted.proofSnippet ?? undefined,
          afterState: promoted.afterState ?? undefined,
        },
      });
      await db.proofCandidate.update({
        where: { id: promoted.id },
        data: {
          status: "promoted",
          promotedAt: new Date(),
          promotedProofRecordId: record.id,
        },
      });
      created++;
    }
  }

  console.log(`Proof candidate seeds: ${created} created`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
