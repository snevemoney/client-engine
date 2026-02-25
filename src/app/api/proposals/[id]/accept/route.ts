/**
 * POST /api/proposals/[id]/accept — Set accepted, optionally create DeliveryProject.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { IntakeLeadStatus } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { buildDefaultDeliveryChecklist, buildDefaultMilestonesFromProposal } from "@/lib/delivery/templates";

const PostSchema = z.object({
  createProject: z.boolean().optional().default(true),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/proposals/[id]/accept", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const proposal = await db.proposal.findUnique({
      where: { id },
      include: { deliveryProjects: { take: 1 } },
    });
    if (!proposal) return jsonError("Proposal not found", 404);

    const raw = await req.json().catch(() => ({}));
    const parsed = PostSchema.safeParse(raw);
    const createProject = parsed.success ? parsed.data.createProject : true;

    const now = new Date();

    let deliveryProjectId: string | null = null;
    const existingProject = proposal.deliveryProjects?.[0];
    if (existingProject) {
      deliveryProjectId = existingProject.id;
    }

    await db.$transaction(async (tx) => {
      await tx.proposal.update({
        where: { id },
        data: { status: "accepted", acceptedAt: now, respondedAt: now, responseStatus: "accepted" },
      });
      await tx.proposalActivity.create({
        data: {
          proposalId: id,
          type: "accepted",
          message: "Proposal accepted",
        },
      });

      if (proposal.intakeLeadId) {
        const intake = await tx.intakeLead.findUnique({
          where: { id: proposal.intakeLeadId },
        });
        if (intake && intake.status !== IntakeLeadStatus.lost) {
          await tx.intakeLead.update({
            where: { id: proposal.intakeLeadId },
            data: { status: IntakeLeadStatus.won },
          });
        }
      }

      if (createProject && !deliveryProjectId) {
        const checklist = buildDefaultDeliveryChecklist();
        const milestones = buildDefaultMilestonesFromProposal(proposal);

        const project = await tx.deliveryProject.create({
          data: {
            proposalId: id,
            intakeLeadId: proposal.intakeLeadId ?? undefined,
            pipelineLeadId: proposal.pipelineLeadId ?? undefined,
            title: proposal.title,
            clientName: proposal.clientName ?? undefined,
            company: proposal.company ?? undefined,
            summary: proposal.summary ?? undefined,
            status: "not_started",
          },
        });

        for (const item of checklist) {
          await tx.deliveryChecklistItem.create({
            data: {
              deliveryProjectId: project.id,
              category: item.category,
              label: item.label,
              isRequired: item.isRequired ?? true,
              sortOrder: item.sortOrder ?? 0,
            },
          });
        }
        for (const m of milestones) {
          await tx.deliveryMilestone.create({
            data: {
              deliveryProjectId: project.id,
              title: m.title,
              description: m.description ?? undefined,
              sortOrder: m.sortOrder ?? 0,
            },
          });
        }
        await tx.deliveryActivity.create({
          data: {
            deliveryProjectId: project.id,
            type: "created",
            message: "Created from accepted proposal",
          },
        });
        deliveryProjectId = project.id;
      }
    });

    if (!deliveryProjectId && createProject) {
      const p = await db.deliveryProject.findFirst({
        where: { proposalId: id },
      });
      deliveryProjectId = p?.id ?? null;
    }

    return NextResponse.json({
      status: "accepted",
      acceptedAt: now.toISOString(),
      deliveryProjectId,
    });
  });
}
