#!/usr/bin/env node
/**
 * Idempotent script to update the /work portfolio:
 *   1. Archive the "Emmanuelle Vandepitterie" project (slug prefix match)
 *   2. Upsert three new live projects
 *
 * Safe to run multiple times — uses upsert semantics.
 *
 * Usage (dev):
 *   node scripts/apply-work-portfolio-update.mjs
 *
 * Usage (prod — inside Docker container):
 *   docker exec -it client-engine-app node scripts/apply-work-portfolio-update.mjs
 *
 * Requires DATABASE_URL in the environment.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const ARCHIVE_SLUG_PREFIX = "emmanuelle";

const newProjects = [
  {
    slug: "ai-partner-os",
    name: "AI Partner OS",
    description:
      "Multi-agent Grok Bot operator OS with 17 specialists for acquire/grow/cut outcomes. Morning brief, human-in-the-loop approvals, audits that become agents that become retainers.",
    techStack: ["Grok Bot", "Cursor", "n8n", "TypeScript", "Telegram"],
    status: "live",
    screenshots: [],
  },
  {
    slug: "cinematic-ai-partner",
    name: "Cinematic AI Partner",
    description:
      "Marketing and proof site for AI Partner positioning on evenslouis.ca. Cinematic landing page, work proofs gallery, and workflow audit CTA.",
    techStack: ["Next.js", "TypeScript", "Tailwind CSS"],
    demoUrl: "https://evenslouis.ca",
    status: "live",
    screenshots: [],
  },
  {
    slug: "report-creator",
    name: "Report Creator",
    description:
      "Self-contained HTML client and ops reports published at evenslouis.ca/reports/<slug> for instant sharing. Part of the Publishing Engine lane.",
    techStack: ["HTML", "Next.js", "TypeScript"],
    status: "live",
    screenshots: [],
  },
];

async function main() {
  // 1. Archive Emmanuelle project(s) by slug prefix
  const archived = await db.project.updateMany({
    where: {
      slug: { startsWith: ARCHIVE_SLUG_PREFIX },
      status: { not: "archived" },
    },
    data: { status: "archived" },
  });
  if (archived.count > 0) {
    console.log(`Archived ${archived.count} project(s) matching slug prefix "${ARCHIVE_SLUG_PREFIX}"`);
  } else {
    console.log(`No non-archived projects found with slug prefix "${ARCHIVE_SLUG_PREFIX}" (already archived or absent)`);
  }

  // 2. Upsert new projects
  for (const p of newProjects) {
    await db.project.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        description: p.description,
        techStack: p.techStack,
        status: p.status,
        screenshots: p.screenshots,
        ...(p.demoUrl !== undefined ? { demoUrl: p.demoUrl } : {}),
      },
      create: p,
    });
    console.log(`Upserted: ${p.name} (${p.slug})`);
  }

  console.log("\nDone. Verify at /work — Emmanuelle should be gone, three new cards visible.");
}

main()
  .catch((e) => {
    console.error("Failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
