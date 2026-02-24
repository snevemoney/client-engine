/**
 * POST /api/delivery-projects/[id]/create-proof-candidate — Create ProofCandidate from project.
 * Idempotent: returns existing if one already linked.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  ProofCandidateSourceType,
  ProofCandidateTriggerType,
} from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

function pickTrigger(project: { githubUrl: string | null; loomUrl: string | null }): ProofCandidateTriggerType {
  if (project.githubUrl?.trim()) return "github";
  if (project.loomUrl?.trim()) return "loom";
  return "manual";
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/delivery-projects/[id]/create-proof-candidate", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const project = await db.deliveryProject.findUnique({
      where: { id },
      include: { intakeLead: true },
    });
    if (!project) return jsonError("Project not found", 404);

    if (project.proofCandidateId) {
      const existing = await db.proofCandidate.findUnique({
        where: { id: project.proofCandidateId },
      });
      if (existing) {
        return NextResponse.json({
          id: existing.id,
          status: existing.status,
          message: "Proof candidate already linked",
        });
      }
    }

    const recent = await db.proofCandidate.findFirst({
      where: {
        sourceType: project.intakeLeadId ? "intake_lead" : "pipeline_lead",
        sourceId: project.intakeLeadId ?? project.pipelineLeadId ?? id,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (recent) {
      await db.deliveryProject.update({
        where: { id },
        data: { proofCandidateId: recent.id },
      });
      return NextResponse.json({
        id: recent.id,
        status: recent.status,
        message: "Linked to recent proof candidate",
      });
    }

    let sourceType: ProofCandidateSourceType = "manual";
    let sourceId: string = id;
    if (project.intakeLeadId) {
      sourceType = "intake_lead";
      sourceId = project.intakeLeadId;
    } else if (project.pipelineLeadId) {
      sourceType = "pipeline_lead";
      sourceId = project.pipelineLeadId;
    }

    const proofSnippet = [
      project.deliveryNotes?.trim(),
      project.summary?.trim(),
    ]
      .filter(Boolean)
      .join(" ") || "Delivery completed.";

    const candidate = await db.proofCandidate.create({
      data: {
        sourceType,
        sourceId,
        intakeLeadId: project.intakeLeadId ?? undefined,
        leadId: project.pipelineLeadId ?? undefined,
        title: `Delivery proof — ${project.title}`,
        company: project.company ?? project.clientName ?? null,
        triggerType: pickTrigger(project),
        githubUrl: project.githubUrl ?? undefined,
        loomUrl: project.loomUrl ?? undefined,
        deliverySummary: project.deliveryNotes ?? project.summary ?? undefined,
        proofSnippet: proofSnippet.slice(0, 2000),
      },
    });

    await db.$transaction([
      db.deliveryProject.update({
        where: { id },
        data: { proofCandidateId: candidate.id, proofCapturedAt: new Date() },
      }),
      db.deliveryActivity.create({
        data: {
          deliveryProjectId: id,
          type: "handoff",
          message: `Proof candidate created: ${candidate.id}`,
          metaJson: { proofCandidateId: candidate.id },
        },
      }),
    ]);

    return NextResponse.json(
      { id: candidate.id, status: candidate.status },
      { status: 201 }
    );
  });
}
