/**
 * Seed sample DeliveryProjects for dev/demo.
 * Run: npm run db:seed-delivery
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const proposal = await db.proposal.findFirst({ where: { status: "accepted" } });
  const intake = await db.intakeLead.findFirst();

  const checklist = [
    { category: "kickoff", label: "Kickoff call scheduled", isRequired: true, sortOrder: 10 },
    { category: "kickoff", label: "Scope and timeline confirmed", isRequired: true, sortOrder: 20 },
    { category: "build", label: "First deliverable draft ready", isRequired: true, sortOrder: 30 },
    { category: "qa", label: "Internal QA pass complete", isRequired: true, sortOrder: 50 },
    { category: "handoff", label: "Handoff documentation complete", isRequired: true, sortOrder: 70 },
  ];

  const milestones = [
    { title: "Discovery", description: "Kickoff", sortOrder: 10 },
    { title: "First deliverable", description: "Initial work", sortOrder: 20 },
    { title: "QA & handoff", description: "Final delivery", sortOrder: 30 },
  ];

  const samples = [
    {
      title: "In progress — due soon",
      status: "in_progress",
      dueDate: new Date(Date.now() + 2 * 86400000),
      proposalId: proposal?.id,
      intakeLeadId: intake?.id,
    },
    {
      title: "Overdue project",
      status: "in_progress",
      dueDate: new Date(Date.now() - 3 * 86400000),
    },
    {
      title: "Completed this week",
      status: "completed",
      completedAt: new Date(),
      dueDate: new Date(),
    },
    {
      title: "Completed, no proof candidate",
      status: "completed",
      completedAt: new Date(Date.now() - 86400000),
      proofRequestedAt: new Date(),
    },
    {
      title: "Blocked QA",
      status: "qa",
      dueDate: new Date(Date.now() + 5 * 86400000),
    },
  ];

  let created = 0;
  for (const s of samples) {
    const existing = await db.deliveryProject.findFirst({
      where: { title: s.title },
    });
    if (existing) continue;

    const project = await db.deliveryProject.create({
      data: {
        title: s.title,
        status: s.status,
        proposalId: s.proposalId,
        intakeLeadId: s.intakeLeadId,
        dueDate: s.dueDate,
        completedAt: s.completedAt,
        proofRequestedAt: s.proofRequestedAt,
      },
    });

    for (const c of checklist) {
      await db.deliveryChecklistItem.create({
        data: {
          deliveryProjectId: project.id,
          category: c.category,
          label: c.label,
          isRequired: c.isRequired,
          sortOrder: c.sortOrder,
        },
      });
    }
    for (const m of milestones) {
      await db.deliveryMilestone.create({
        data: {
          deliveryProjectId: project.id,
          title: m.title,
          description: m.description,
          sortOrder: m.sortOrder,
        },
      });
    }
    await db.deliveryActivity.create({
      data: {
        deliveryProjectId: project.id,
        type: "created",
        message: "Seeded",
      },
    });
    created++;
  }
  console.log(`Created ${created} sample delivery projects.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
