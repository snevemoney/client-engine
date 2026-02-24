/**
 * Seed sample ProofRecords for dev/demo.
 * Run: node prisma/seed-proof.mjs
 * Requires at least one IntakeLead to exist (run seed-intake-leads first).
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const intake = await db.intakeLead.findFirst({ where: { status: "won" } });
  if (!intake) {
    console.log("No won intake lead found. Run db:seed-intake-leads first, or mark one as won.");
    return;
  }

  const created = await db.proofRecord.create({
    data: {
      sourceType: "intake_lead",
      sourceId: intake.id,
      intakeLeadId: intake.id,
      title: [intake.title, intake.company].filter(Boolean).join(" — ") || intake.title,
      company: intake.company ?? undefined,
      outcome: "won",
      proofSnippet: "Sample proof: Consolidated tools, reduced admin time by ~2 hrs/week.",
      beforeState: "Too many tools, manual processes",
      afterState: "Single system, automated flows",
      metricValue: "2",
      metricLabel: "hrs/week saved",
    },
  });
  console.log(`Proof record created: ${created.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
