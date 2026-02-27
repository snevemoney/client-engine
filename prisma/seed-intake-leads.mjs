/**
 * Seed sample IntakeLeads for dev/demo.
 * Run: node prisma/seed-intake-leads.mjs
 * Requires NODE_ENV=development or SEED_DEMO_DATA=1 — blocks accidental prod use.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function isDevOrExplicit() {
  const env = process.env.NODE_ENV;
  const explicit = process.env.SEED_DEMO_DATA === "1" || process.env.SEED_DEMO_DATA === "true";
  return env === "development" || explicit;
}

const SAMPLE_LEADS = [
  {
    source: "upwork",
    title: "Need funnel automation for coaching business",
    company: "Growth Coaches Inc",
    contactName: "Jane",
    summary: "We run a coaching business and need to automate our funnel. Looking for someone who can set up Kartra or similar, integrate Calendly, and build a simple CRM flow.",
    budgetMin: 2000,
    budgetMax: 5000,
    urgency: "medium",
    status: "new",
    tags: ["funnel", "automation", "kartra"],
  },
  {
    source: "linkedin",
    title: "Operations audit and tool consolidation",
    company: "TechScale LLC",
    contactName: null,
    contactEmail: "ops@techscale.io",
    link: "https://linkedin.com/jobs/example",
    summary: "We've accumulated too many tools. Need an audit of our ops stack and a plan to consolidate. Prefer someone with experience in small B2B service businesses.",
    budgetMin: null,
    budgetMax: null,
    urgency: "low",
    status: "qualified",
    score: 72,
    scoreReason: "Source: linkedin (higher-intent). Fit keywords: automation, operations, workflow.",
    tags: ["operations", "audit", "tools"],
  },
  {
    source: "referral",
    title: "Website rebuild + AI chat widget",
    company: "Local Dental Group",
    contactName: "Dr. Smith",
    summary: "Referred by Sarah at Marketing Pro. Need a new website and want to add an AI chat for appointment booking. Budget is flexible.",
    budgetMin: 5000,
    budgetMax: 12000,
    urgency: "high",
    status: "proposal_drafted",
    score: 85,
    tags: ["website", "ai", "referral"],
  },
  {
    source: "inbound",
    title: "Ads management and funnel optimization",
    company: null,
    summary: "Found you through Google. We run Meta and Google ads, conversion is low. Need someone to audit and fix the funnel.",
    budgetMin: 1500,
    budgetMax: 3000,
    urgency: "medium",
    status: "sent",
    score: 68,
    tags: ["ads", "funnel", "meta"],
  },
  {
    source: "rss",
    title: "RSS-scraped opportunity",
    company: "RSS Corp",
    summary: "Ingested from feed. Generic opportunity. Low signal.",
    budgetMin: null,
    budgetMax: null,
    urgency: "low",
    status: "archived",
    score: 28,
    tags: ["rss"],
  },
];

async function main() {
  if (!isDevOrExplicit()) {
    console.error("db:seed-intake-leads is for dev/demo only. Set NODE_ENV=development or SEED_DEMO_DATA=1 to run.");
    process.exit(1);
  }

  let created = 0;
  for (const l of SAMPLE_LEADS) {
    await db.intakeLead.create({
      data: {
        source: l.source,
        title: l.title,
        company: l.company ?? undefined,
        contactName: l.contactName ?? undefined,
        contactEmail: l.contactEmail ?? undefined,
        link: l.link ?? undefined,
        summary: l.summary,
        budgetMin: l.budgetMin ?? undefined,
        budgetMax: l.budgetMax ?? undefined,
        urgency: l.urgency,
        status: l.status,
        score: l.score ?? undefined,
        scoreReason: l.scoreReason ?? undefined,
        tags: l.tags ?? [],
      },
    });
    created++;
  }
  console.log(`Intake leads: ${created} created`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
