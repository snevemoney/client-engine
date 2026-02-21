#!/usr/bin/env node
/**
 * Creates a lead with source "research" and a RESEARCH_SNAPSHOT artifact.
 * Use to test "Research → proposal (why now)" without the real discover/extract pipeline.
 * Prints the lead ID so you can open /dashboard/leads/<id> and trigger pipeline retry.
 *
 * Usage: node scripts/create-research-lead.mjs
 * Optional: LEAD_TITLE="My title" node scripts/create-research-lead.mjs
 */

import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const title = process.env.LEAD_TITLE || "Research Lead 001";
const sourceUrl = process.env.SOURCE_URL || "https://example.com/post";
const snapshotContent =
  process.env.SNAPSHOT_CONTENT ||
  "They publicly asked for workflow automation help to reduce manual onboarding + invoicing. Mentioned urgency this week. Uses HubSpot + Sheets.";

async function main() {
  const lead = await db.lead.create({
    data: {
      title,
      source: "research",
      sourceUrl,
    },
  });
  await db.artifact.create({
    data: {
      leadId: lead.id,
      type: "research",
      title: "RESEARCH_SNAPSHOT",
      content: snapshotContent,
      meta: { sourceUrl, capturedAt: new Date().toISOString() },
    },
  });
  console.log(lead.id);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
