import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { LeadActivityType, ProofCandidateStatus, ProofCandidateSourceType, ProofCandidateTriggerType } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { buildProofCandidateFromIntakeLead } from "@/lib/proof-candidates/build-from-intake";
import { computeProofCandidateReadiness } from "@/lib/proof-candidates/readiness";

const PostSchema = z.object({
  title: z.string().max(500).optional().nullable(),
  proofSnippet: z.string().max(5000).optional().nullable(),
  beforeState: z.string().max(2000).optional().nullable(),
  afterState: z.string().max(2000).optional().nullable(),
  metricLabel: z.string().max(100).optional().nullable(),
  metricValue: z.string().max(100).optional().nullable(),
});

function toCandidateJson(c: {
  id: string;
  title: string;
  company: string | null;
  triggerType: string;
  status: string;
  githubUrl: string | null;
  loomUrl: string | null;
  deliverySummary: string | null;
  proofSnippet: string | null;
  beforeState: string | null;
  afterState: string | null;
  metricLabel: string | null;
  metricValue: string | null;
  tags: string[];
  readyAt: Date | null;
  promotedAt: Date | null;
  promotedProofRecordId: string | null;
  intakeLeadId: string | null;
  leadId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: c.id,
    title: c.title ?? "",
    company: c.company ?? null,
    triggerType: c.triggerType ?? "manual",
    status: c.status ?? "draft",
    githubUrl: c.githubUrl ?? null,
    loomUrl: c.loomUrl ?? null,
    deliverySummary: c.deliverySummary ?? null,
    proofSnippet: c.proofSnippet ?? null,
    beforeState: c.beforeState ?? null,
    afterState: c.afterState ?? null,
    metricLabel: c.metricLabel ?? null,
    metricValue: c.metricValue ?? null,
    tags: Array.isArray(c.tags) ? c.tags : [],
    readyAt: c.readyAt?.toISOString() ?? null,
    promotedAt: c.promotedAt?.toISOString() ?? null,
    promotedProofRecordId: c.promotedProofRecordId ?? null,
    intakeLeadId: c.intakeLeadId ?? null,
    leadId: c.leadId ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

/** POST /api/intake-leads/[id]/proof-candidate */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/intake-leads/[id]/proof-candidate", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const intake = await db.intakeLead.findUnique({ where: { id } });
    if (!intake) return jsonError("Lead not found", 404);

    const raw = await req.json().catch(() => ({}));
    const parsed = PostSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join("; ");
      return jsonError(msg || "Invalid request body", 400, "VALIDATION");
    }
    const options = parsed.data;

    const draft = buildProofCandidateFromIntakeLead(
      {
        id: intake.id,
        title: intake.title,
        company: intake.company,
        summary: intake.summary,
        githubUrl: intake.githubUrl,
        loomUrl: intake.loomUrl,
        deliverySummary: intake.deliverySummary,
      },
      {
        title: options.title ?? undefined,
        proofSnippet: options.proofSnippet ?? undefined,
        beforeState: options.beforeState ?? undefined,
        afterState: options.afterState ?? undefined,
        metricLabel: options.metricLabel ?? undefined,
        metricValue: options.metricValue ?? undefined,
      }
    );

    const candidate = await db.$transaction(async (tx) => {
      const c = await tx.proofCandidate.create({
        data: {
          sourceType: ProofCandidateSourceType.intake_lead,
          sourceId: draft.sourceId,
          intakeLeadId: id,
          title: draft.title,
          company: draft.company,
          triggerType: draft.triggerType as ProofCandidateTriggerType,
          githubUrl: draft.githubUrl,
          loomUrl: draft.loomUrl,
          deliverySummary: draft.deliverySummary,
          proofSnippet: draft.proofSnippet,
          beforeState: draft.beforeState,
          afterState: draft.afterState,
          metricLabel: draft.metricLabel,
          metricValue: draft.metricValue,
          status: ProofCandidateStatus.draft,
        },
      });
      await tx.intakeLead.update({
        where: { id },
        data: { proofCandidateCount: (intake.proofCandidateCount ?? 0) + 1 },
      });
      await tx.leadActivity.create({
        data: {
          intakeLeadId: id,
          type: LeadActivityType.proof_candidate_created,
          content: `Proof candidate created: ${draft.title}`,
          metadataJson: { proofCandidateId: c.id },
        },
      });
      return c;
    });

    const readiness = computeProofCandidateReadiness(candidate);

    return NextResponse.json({
      ok: true,
      candidate: toCandidateJson(candidate),
      readiness,
    });
  });
}
