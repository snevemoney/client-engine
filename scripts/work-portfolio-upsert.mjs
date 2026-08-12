/**
 * One-shot idempotent script: update /work portfolio data in production.
 *
 * What it does:
 *   1. Archives "Emmanuelle Vandepitterie" project (by slug pattern or name)
 *   2. Upserts "AI Partner / Outer Heaven OS" project
 *   3. Upserts "Cinematic AI Partner" project
 *
 * Safe to run multiple times — uses upsert on unique slug.
 *
 * Usage (operator, against prod DB):
 *   DATABASE_URL="postgresql://..." node scripts/work-portfolio-upsert.mjs
 *
 * Verification:
 *   After running, visit https://evenslouis.ca/work and confirm:
 *   - Emmanuelle no longer appears
 *   - "AI Partner / Outer Heaven OS" card is visible
 *   - "Cinematic AI Partner" card is visible
 *
 * NO secrets are committed. Operator must supply DATABASE_URL at runtime.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const ARCHIVE_SLUGS = ["emmanuelle-vandepitterie-backstage-bankable"];
const ARCHIVE_NAME_PATTERN = "Emmanuelle Vandepitterie";

const newProjects = [
  {
    slug: "outer-heaven-os",
    name: "AI Partner / Outer Heaven OS",
    description:
      "17-agent Grok Bot operator OS — runs audits, deploys agents, and manages retainers end-to-end. Business proof for the AI Partner practice: autonomous prospecting, research orchestration, and delivery coordination across Telegram, n8n workflows, and the Client Engine pipeline.",
    repoUrl: null,
    techStack: ["Grok Bot", "Cursor", "Next.js", "n8n", "Prisma", "Telegram API"],
    status: "live",
    screenshots: [],
  },
  {
    slug: "cinematic-ai-partner",
    name: "Cinematic AI Partner",
    description:
      "Cinematic growth-team landing page for the AI Partner practice. Operator-grade positioning with scroll-driven animations, dark-mode-first design, and conversion-focused copy. Showcases the autonomous agent stack and builds trust through visual storytelling.",
    repoUrl: null,
    techStack: ["Next.js", "Framer Motion", "Tailwind CSS", "Vercel"],
    status: "live",
    screenshots: [],
  },
];

async function archiveEmmanuelle() {
  let archived = 0;

  for (const slug of ARCHIVE_SLUGS) {
    const result = await db.project.updateMany({
      where: { slug },
      data: { status: "archived" },
    });
    archived += result.count;
  }

  const byName = await db.project.updateMany({
    where: {
      name: { contains: ARCHIVE_NAME_PATTERN },
      status: { not: "archived" },
    },
    data: { status: "archived" },
  });
  archived += byName.count;

  return archived;
}

async function upsertProjects() {
  const results = [];
  for (const p of newProjects) {
    const result = await db.project.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        description: p.description,
        repoUrl: p.repoUrl,
        techStack: p.techStack,
        status: p.status,
        screenshots: p.screenshots,
      },
      create: p,
    });
    results.push({ slug: result.slug, action: result.createdAt === result.updatedAt ? "created" : "updated" });
  }
  return results;
}

async function main() {
  console.log("=== Work Portfolio Upsert (prod-safe, idempotent) ===\n");

  const archived = await archiveEmmanuelle();
  console.log(`Archived Emmanuelle projects: ${archived}`);

  const upserted = await upsertProjects();
  for (const r of upserted) {
    console.log(`  ${r.action}: ${r.slug}`);
  }

  const liveCount = await db.project.count({ where: { status: "live" } });
  console.log(`\nTotal live projects: ${liveCount}`);
  console.log("\nDone. Verify at https://evenslouis.ca/work");
}

main()
  .catch((e) => {
    console.error("FAILED:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
