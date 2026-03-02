/**
 * One-time backfill: fix lead statuses stuck at SCORED.
 * Leads with delivery projects → BUILDING (or SHIPPED if completed).
 * Leads with proposals but no delivery → APPROVED.
 *
 * Run: npx tsx scripts/backfill-lead-status.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  // 1. Leads with completed delivery projects → SHIPPED
  const completedDeliveries = await db.deliveryProject.findMany({
    where: { status: "completed", pipelineLeadId: { not: null } },
    select: { pipelineLeadId: true },
  });
  const shippedIds = [...new Set(completedDeliveries.map((d) => d.pipelineLeadId!))];
  if (shippedIds.length > 0) {
    const { count } = await db.lead.updateMany({
      where: { id: { in: shippedIds }, status: "SCORED" },
      data: { status: "SHIPPED" },
    });
    console.log(`SHIPPED: ${count} leads (had completed delivery)`);
  }

  // 2. Leads with active delivery projects → BUILDING
  const activeDeliveries = await db.deliveryProject.findMany({
    where: {
      status: { notIn: ["completed", "archived"] },
      pipelineLeadId: { not: null },
    },
    select: { pipelineLeadId: true },
  });
  const buildingIds = [...new Set(activeDeliveries.map((d) => d.pipelineLeadId!))];
  if (buildingIds.length > 0) {
    const { count } = await db.lead.updateMany({
      where: { id: { in: buildingIds }, status: "SCORED" },
      data: { status: "BUILDING" },
    });
    console.log(`BUILDING: ${count} leads (have active delivery)`);
  }

  // 3. Leads with proposals (any status) → APPROVED
  const proposedLeads = await db.proposal.findMany({
    where: { pipelineLeadId: { not: null } },
    select: { pipelineLeadId: true },
    distinct: ["pipelineLeadId"],
  });
  const approvedIds = proposedLeads.map((p) => p.pipelineLeadId!);
  if (approvedIds.length > 0) {
    const { count } = await db.lead.updateMany({
      where: { id: { in: approvedIds }, status: "SCORED" },
      data: { status: "APPROVED" },
    });
    console.log(`APPROVED: ${count} leads (have proposals but no delivery)`);
  }

  // Summary
  const counts = await db.lead.groupBy({
    by: ["status"],
    _count: true,
    orderBy: { _count: { status: "desc" } },
  });
  console.log("\nFinal status distribution:");
  for (const c of counts) {
    console.log(`  ${c.status}: ${c._count}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
