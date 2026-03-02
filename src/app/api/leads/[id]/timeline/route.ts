/**
 * GET /api/leads/[id]/timeline — Unified client journey timeline.
 * Aggregates LeadActivity (from promotedFromIntake), ProposalActivity,
 * DeliveryActivity, and ClientInteraction (Phase 9.2) across linked entities.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";

interface TimelineEntry {
  id: string;
  entityType: "intake" | "lead" | "proposal" | "delivery" | "interaction";
  entityId: string;
  entityTitle: string;
  activityType: string;
  message: string;
  createdAt: string;
  /** Phase 9.2: interaction metadata */
  channel?: string | null;
  direction?: string | null;
  nextActionSummary?: string | null;
  nextActionDueAt?: string | null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("GET /api/leads/[id]/timeline", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { id } = await params;

    const [lead, interactions] = await Promise.all([
      db.lead.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          promotedFromIntake: {
            select: {
              id: true,
              title: true,
              activities: { orderBy: { createdAt: "desc" }, take: 25 },
            },
          },
          proposals: {
            select: {
              id: true,
              title: true,
              activities: { orderBy: { createdAt: "desc" }, take: 25 },
            },
          },
          deliveryProjects: {
            select: {
              id: true,
              title: true,
              activities: { orderBy: { createdAt: "desc" }, take: 25 },
            },
          },
        },
      }),
      // Phase 9.2: ClientInteraction records linked to this lead
      db.clientInteraction.findMany({
        where: { pipelineLeadId: id },
        orderBy: { occurredAt: "desc" },
        take: 50,
      }),
    ]);

    if (!lead) return jsonError("Not found", 404);

    const entries: TimelineEntry[] = [];

    // Intake activities
    if (lead.promotedFromIntake) {
      const intake = lead.promotedFromIntake;
      for (const a of intake.activities) {
        entries.push({
          id: a.id,
          entityType: "intake",
          entityId: intake.id,
          entityTitle: intake.title,
          activityType: a.type,
          message: a.content,
          createdAt: a.createdAt.toISOString(),
        });
      }
    }

    // Proposal activities
    for (const proposal of lead.proposals) {
      for (const a of proposal.activities) {
        entries.push({
          id: a.id,
          entityType: "proposal",
          entityId: proposal.id,
          entityTitle: proposal.title,
          activityType: a.type,
          message: a.message ?? a.type,
          createdAt: a.createdAt.toISOString(),
        });
      }
    }

    // Delivery activities
    for (const dp of lead.deliveryProjects) {
      for (const a of dp.activities) {
        entries.push({
          id: a.id,
          entityType: "delivery",
          entityId: dp.id,
          entityTitle: dp.title,
          activityType: a.type,
          message: a.message ?? a.type,
          createdAt: a.createdAt.toISOString(),
        });
      }
    }

    // Phase 9.2: Client Interaction ledger entries
    for (const ci of interactions) {
      entries.push({
        id: ci.id,
        entityType: "interaction",
        entityId: ci.id,
        entityTitle: ci.clientName ?? "Client Interaction",
        activityType: ci.category,
        message: ci.summary,
        createdAt: ci.occurredAt.toISOString(),
        channel: ci.channel,
        direction: ci.direction,
        nextActionSummary: ci.nextActionSummary,
        nextActionDueAt: ci.nextActionDueAt?.toISOString() ?? null,
      });
    }

    entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ entries: entries.slice(0, 100) });
  });
}
