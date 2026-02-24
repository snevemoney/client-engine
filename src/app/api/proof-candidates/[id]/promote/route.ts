import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProofCandidateStatus, LeadActivityType } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { computeProofCandidateReadiness } from "@/lib/proof-candidates/readiness";

/** POST /api/proof-candidates/[id]/promote */
export async function POST(
  _req: unknown,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/proof-candidates/[id]/promote", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const candidate = await db.proofCandidate.findUnique({
      where: { id },
      include: { intakeLead: true },
    });
    if (!candidate) return jsonError("Proof candidate not found", 404);

    if (candidate.status === ProofCandidateStatus.promoted && candidate.promotedProofRecordId) {
      const existingRecord = await db.proofRecord.findUnique({
        where: { id: candidate.promotedProofRecordId },
      });
      return NextResponse.json({
        ok: true,
        proofRecord: existingRecord
          ? {
              id: existingRecord.id,
              title: existingRecord.title,
              company: existingRecord.company ?? null,
              outcome: existingRecord.outcome ?? "won",
              createdAt: existingRecord.createdAt.toISOString(),
            }
          : null,
        candidate: {
          id: candidate.id,
          status: candidate.status,
          promotedProofRecordId: candidate.promotedProofRecordId,
        },
      });
    }

    if (candidate.status === ProofCandidateStatus.rejected) {
      return jsonError("Cannot promote rejected candidate", 400, "VALIDATION");
    }

    const { isReady, reasons } = computeProofCandidateReadiness(candidate);
    const minFieldsOk = !!(candidate.title?.trim() && candidate.proofSnippet?.trim());
    if (!isReady && !minFieldsOk) {
      return jsonError(`Not ready: ${reasons.join("; ")}`, 400, "VALIDATION");
    }

    const result = await db.$transaction(async (tx) => {
      const record = await tx.proofRecord.create({
        data: {
          sourceType: candidate.sourceType,
          sourceId: (candidate.sourceId ?? candidate.intakeLeadId ?? candidate.id).toString(),
          intakeLeadId: candidate.intakeLeadId ?? undefined,
          proofCandidateId: candidate.id,
          title: candidate.title,
          company: candidate.company ?? undefined,
          outcome: "won",
          proofSnippet: candidate.proofSnippet ?? undefined,
          beforeState: candidate.beforeState ?? undefined,
          afterState: candidate.afterState ?? undefined,
          metricLabel: candidate.metricLabel ?? undefined,
          metricValue: candidate.metricValue ?? undefined,
        },
      });

      await tx.proofCandidate.update({
        where: { id },
        data: {
          status: ProofCandidateStatus.promoted,
          promotedAt: new Date(),
          promotedProofRecordId: record.id,
        },
      });

      if (candidate.intakeLeadId) {
        await tx.leadActivity.create({
          data: {
            intakeLeadId: candidate.intakeLeadId,
            type: LeadActivityType.proof_candidate_promoted,
            content: `Proof candidate promoted to record: ${candidate.title}`,
            metadataJson: {
              proofCandidateId: candidate.id,
              proofRecordId: record.id,
            },
          },
        });
      }

      return record;
    });

    return NextResponse.json({
      ok: true,
      proofRecord: {
        id: result.id,
        title: result.title,
        company: result.company ?? null,
        outcome: result.outcome ?? "won",
        proofSnippet: result.proofSnippet ?? null,
        createdAt: result.createdAt.toISOString(),
      },
      candidate: {
        id: candidate.id,
        status: ProofCandidateStatus.promoted,
        promotedProofRecordId: result.id,
      },
    });
  });
}
