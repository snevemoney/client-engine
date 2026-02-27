/**
 * Seed sample states for command center / Phase 1.5 demo.
 * Run: npm run db:seed-command-center
 * Requires NODE_ENV=development or SEED_DEMO_DATA=1 — blocks accidental prod use.
 * Requires intake leads (run db:seed-intake-leads first).
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function isDevOrExplicit() {
  const env = process.env.NODE_ENV;
  const explicit = process.env.SEED_DEMO_DATA === "1" || process.env.SEED_DEMO_DATA === "true";
  return env === "development" || explicit;
}

async function main() {
  if (!isDevOrExplicit()) {
    console.error("db:seed-command-center is for dev/demo only. Set NODE_ENV=development or SEED_DEMO_DATA=1 to run.");
    process.exit(1);
  }

  const intakeLeads = await db.intakeLead.findMany({ take: 10, orderBy: { createdAt: "desc" } });
  if (intakeLeads.length === 0) {
    console.log("No intake leads. Run db:seed-intake-leads first.");
    return;
  }

  let updated = 0;

  const toQualify = intakeLeads.find((l) => l.status === "new" && !l.promotedLeadId);
  if (toQualify) {
    await db.intakeLead.update({
      where: { id: toQualify.id },
      data: { status: "qualified" },
    });
    updated++;
  }

  const toSent = intakeLeads.find((l) => l.status === "qualified" && !l.promotedLeadId && l.id !== toQualify?.id);
  if (toSent) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await db.intakeLead.update({
      where: { id: toSent.id },
      data: {
        status: "sent",
        proposalSentAt: new Date(),
        followUpDueAt: yesterday,
      },
    });
    updated++;
  }

  const toWon = intakeLeads.find((l) => ["sent", "qualified"].includes(l.status) && l.id !== toSent?.id);
  if (toWon) {
    const won = await db.intakeLead.update({
      where: { id: toWon.id },
      data: { status: "won" },
    });
    const hasProof = await db.proofCandidate.findFirst({ where: { intakeLeadId: won.id } });
    if (!hasProof) {
      await db.proofCandidate.create({
        data: {
          sourceType: "intake_lead",
          sourceId: won.id,
          intakeLeadId: won.id,
          title: `Delivery proof — ${won.title || "Won lead"}`,
          company: won.company ?? null,
          triggerType: "manual",
          proofSnippet: "Delivered work. Sample.",
          status: "ready",
          readyAt: new Date(),
        },
      });
      updated++;
    }
  }

  const draftCandidate = await db.proofCandidate.findFirst({ where: { status: "draft" } });
  if (draftCandidate) {
    await db.proofCandidate.update({
      where: { id: draftCandidate.id },
      data: {
        proofSnippet: "Delivered work for client. Sample.",
        afterState: "Shipped",
        status: "ready",
        readyAt: new Date(),
      },
    });
    updated++;
  }

  console.log(`Command center seeds: ${updated} updates`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
