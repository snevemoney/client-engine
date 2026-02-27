/**
 * Seed sample Proposals for dev/demo.
 * Run: npm run db:seed-proposals
 * Requires NODE_ENV=development or SEED_DEMO_DATA=1 — blocks accidental prod use.
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
    console.error("db:seed-proposals is for dev/demo only. Set NODE_ENV=development or SEED_DEMO_DATA=1 to run.");
    process.exit(1);
  }

  const intake = await db.intakeLead.findFirst({ where: { status: { notIn: ["won", "lost"] } } });
  const lead = await db.lead.findFirst({ where: { status: { not: "REJECTED" } } });

  const samples = [
    {
      title: "Draft incomplete — funnel automation",
      status: "draft",
      clientName: "Acme Co",
      company: "Acme Co",
      summary: "Need funnel automation.",
      scopeOfWork: null,
      deliverables: null,
      cta: null,
      priceType: null,
      intakeLeadId: intake?.id,
    },
    {
      title: "Ready not sent — ops audit",
      status: "ready",
      clientName: "TechScale",
      company: "TechScale LLC",
      summary: "Operations audit and tool consolidation.",
      scopeOfWork: "Audit current stack, recommend consolidation plan.",
      deliverables: ["Audit report", "Consolidation plan"],
      cta: "Reply to schedule kickoff.",
      priceType: "range",
      priceMin: 2000,
      priceMax: 4000,
      intakeLeadId: intake?.id,
    },
    {
      title: "Sent awaiting response",
      status: "sent",
      sentAt: new Date(),
      clientName: "Growth Coaches",
      company: "Growth Coaches Inc",
      summary: "Funnel automation for coaching business.",
      scopeOfWork: "Kartra setup, Calendly integration.",
      deliverables: ["Setup", "Documentation"],
      cta: "Reply to confirm.",
      priceType: "fixed",
      priceMin: 3500,
      intakeLeadId: intake?.id,
    },
    {
      title: "Accepted — dental website",
      status: "accepted",
      acceptedAt: new Date(),
      clientName: "Dr. Smith",
      company: "Local Dental Group",
      summary: "Website rebuild + AI chat.",
      scopeOfWork: "New website, AI chat for appointments.",
      deliverables: ["Website", "Chat widget"],
      cta: "Confirmed.",
      priceType: "fixed",
      priceMin: 8000,
      intakeLeadId: intake?.id,
      pipelineLeadId: lead?.id,
    },
    {
      title: "Rejected proposal",
      status: "rejected",
      rejectedAt: new Date(),
      clientName: "Other Co",
      company: "Other Co",
      summary: "Budget mismatch.",
      scopeOfWork: "Scope",
      deliverables: ["X"],
      cta: "N/A",
      priceType: "fixed",
      priceMin: 5000,
    },
  ];

  let created = 0;
  for (const s of samples) {
    const existing = await db.proposal.findFirst({
      where: { title: s.title },
    });
    if (existing) continue;
    await db.proposal.create({
      data: {
        ...s,
        scopeOfWork: s.scopeOfWork ?? undefined,
        deliverables: s.deliverables ?? undefined,
        cta: s.cta ?? undefined,
        priceType: s.priceType ?? undefined,
      },
    });
    created++;
  }
  console.log(`Created ${created} sample proposals.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
