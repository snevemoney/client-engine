/**
 * Seed sample IntakeLeads for follow-up queue testing.
 * Creates overdue, today, upcoming, won, lost, promoted leads.
 * Run: node prisma/seed-followups.mjs
 * Prerequisite: run db:seed-intake-leads first or have existing intake leads.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function addDays(d, days) {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function main() {
  const now = new Date();
  const today = startOfToday();
  const yesterday = addDays(today, -1);
  const threeDays = addDays(today, 3);

  const existing = await db.intakeLead.findFirst();
  if (!existing) {
    console.log("No intake leads found. Run db:seed-intake-leads first.");
    return;
  }

  let created = 0;

  const samples = [
    {
      source: "upwork",
      title: "Overdue follow-up (seed)",
      company: "Overdue Corp",
      summary: "Sample for overdue bucket. Due yesterday.",
      status: "sent",
      nextAction: "Send second follow-up",
      nextActionDueAt: yesterday,
      followUpDueAt: yesterday,
      followUpCount: 1,
      lastContactedAt: addDays(yesterday, -3),
    },
    {
      source: "linkedin",
      title: "Due today (seed)",
      company: "Today Inc",
      summary: "Sample for today bucket.",
      status: "sent",
      nextAction: "Call to confirm interest",
      nextActionDueAt: today,
      followUpDueAt: today,
      followUpCount: 0,
    },
    {
      source: "referral",
      title: "Upcoming in 3 days (seed)",
      company: "Upcoming LLC",
      summary: "Sample for upcoming bucket.",
      status: "qualified",
      nextAction: "Send proposal",
      nextActionDueAt: threeDays,
      followUpDueAt: threeDays,
      followUpCount: 2,
      lastContactedAt: addDays(today, -2),
    },
    {
      source: "inbound",
      title: "Won lead (excluded)",
      company: "Won Corp",
      summary: "Excluded from follow-up queue.",
      status: "won",
      nextAction: null,
      nextActionDueAt: null,
      followUpDueAt: null,
    },
    {
      source: "inbound",
      title: "Lost lead (excluded)",
      company: "Lost Inc",
      summary: "Excluded from follow-up queue.",
      status: "lost",
      nextAction: null,
      nextActionDueAt: null,
      followUpDueAt: null,
    },
  ];

  for (const s of samples) {
    await db.intakeLead.create({
      data: {
        source: s.source,
        title: s.title,
        company: s.company ?? undefined,
        summary: s.summary,
        status: s.status,
        nextAction: s.nextAction ?? undefined,
        nextActionDueAt: s.nextActionDueAt ?? undefined,
        followUpDueAt: s.followUpDueAt ?? undefined,
        followUpCount: s.followUpCount ?? 0,
        lastContactedAt: s.lastContactedAt ?? undefined,
      },
    });
    created++;
  }

  const promoted = await db.intakeLead.create({
    data: {
      source: "referral",
      title: "Promoted lead with follow-up (seed)",
      company: "Promoted Co",
      summary: "Has promoted pipeline lead.",
      status: "sent",
      nextAction: "Schedule call",
      nextActionDueAt: threeDays,
      followUpDueAt: threeDays,
      followUpCount: 1,
    },
  });

  const pipelineLead = await db.lead.create({
    data: {
      title: promoted.title,
      source: "referral",
      status: "ENRICHED",
      nextContactAt: threeDays,
      techStack: [],
      tags: [],
    },
  });

  await db.intakeLead.update({
    where: { id: promoted.id },
    data: { promotedLeadId: pipelineLead.id },
  });
  created++;

  await db.leadActivity.create({
    data: {
      intakeLeadId: promoted.id,
      type: "followup",
      content: "Follow-up set: Schedule call (due in 3 days)",
    },
  });

  console.log(`Follow-up seeds: ${created} intake leads created, 1 promoted with activity`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
