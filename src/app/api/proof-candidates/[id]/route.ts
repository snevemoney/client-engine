import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProofCandidateStatus } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { isValidHttpUrl, isGitHubUrl, isLoomUrl } from "@/lib/delivery/url";
import { computeProofCandidateReadiness } from "@/lib/proof-candidates/readiness";

function toItem(c: {
  id: string;
  title: string;
  company: string | null;
  triggerType: string;
  sourceType: string;
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
  rejectedReason: string | null;
  intakeLeadId: string | null;
  leadId: string | null;
  sourceId: string | null;
  assetUrlsJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  const readiness = computeProofCandidateReadiness(c);
  return {
    id: c.id,
    title: c.title ?? "",
    company: c.company ?? null,
    triggerType: c.triggerType ?? "manual",
    sourceType: c.sourceType ?? "intake_lead",
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
    rejectedReason: c.rejectedReason ?? null,
    intakeLeadId: c.intakeLeadId ?? null,
    leadId: c.leadId ?? null,
    sourceId: c.sourceId ?? null,
    assetUrlsJson: c.assetUrlsJson ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    readiness,
  };
}

/** GET /api/proof-candidates/[id] */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("GET /api/proof-candidates/[id]", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const c = await db.proofCandidate.findUnique({ where: { id } });
    if (!c) return jsonError("Proof candidate not found", 404);

    return NextResponse.json(toItem(c));
  });
}

const PatchSchema = z.object({
  title: z.string().max(500).optional(),
  company: z.string().max(200).optional().nullable(),
  githubUrl: z.string().max(500).optional().nullable().or(z.literal("")),
  loomUrl: z.string().max(500).optional().nullable().or(z.literal("")),
  deliverySummary: z.string().max(5000).optional().nullable(),
  proofSnippet: z.string().max(5000).optional().nullable(),
  beforeState: z.string().max(2000).optional().nullable(),
  afterState: z.string().max(2000).optional().nullable(),
  metricLabel: z.string().max(100).optional().nullable(),
  metricValue: z.string().max(100).optional().nullable(),
  tags: z.array(z.string().max(50)).optional(),
  status: z.enum(["draft", "ready", "promoted", "rejected"]).optional(),
  rejectedReason: z.string().max(500).optional().nullable(),
});

/** PATCH /api/proof-candidates/[id] */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("PATCH /api/proof-candidates/[id]", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const existing = await db.proofCandidate.findUnique({ where: { id } });
    if (!existing) return jsonError("Proof candidate not found", 404);

    if (existing.status === ProofCandidateStatus.promoted) {
      return jsonError("Cannot edit promoted candidate", 400, "VALIDATION");
    }

    const raw = await req.json().catch(() => null);
    const parsed = PatchSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join("; ");
      return jsonError(msg || "Invalid request body", 400, "VALIDATION");
    }
    const body = parsed.data;

    const githubVal = body.githubUrl !== undefined ? (body.githubUrl?.trim() || null) : undefined;
    const loomVal = body.loomUrl !== undefined ? (body.loomUrl?.trim() || null) : undefined;
    if (githubVal && !isGitHubUrl(githubVal)) {
      return jsonError("Invalid GitHub URL", 400, "VALIDATION");
    }
    if (loomVal && !isLoomUrl(loomVal)) {
      return jsonError("Invalid Loom URL", 400, "VALIDATION");
    }

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.company !== undefined) updateData.company = body.company;
    if (body.githubUrl !== undefined) updateData.githubUrl = githubVal;
    if (body.loomUrl !== undefined) updateData.loomUrl = loomVal;
    if (body.deliverySummary !== undefined) updateData.deliverySummary = body.deliverySummary?.trim() || null;
    if (body.proofSnippet !== undefined) updateData.proofSnippet = body.proofSnippet?.trim() || null;
    if (body.beforeState !== undefined) updateData.beforeState = body.beforeState?.trim() || null;
    if (body.afterState !== undefined) updateData.afterState = body.afterState?.trim() || null;
    if (body.metricLabel !== undefined) updateData.metricLabel = body.metricLabel?.trim() || null;
    if (body.metricValue !== undefined) updateData.metricValue = body.metricValue?.trim() || null;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.rejectedReason !== undefined) updateData.rejectedReason = body.rejectedReason?.trim() || null;

    if (body.status === "ready") {
      const candidateWithUpdates = { ...existing, ...updateData };
      const { isReady, reasons } = computeProofCandidateReadiness(candidateWithUpdates);
      if (!isReady) {
        return jsonError(`Not ready: ${reasons.join("; ")}`, 400, "VALIDATION");
      }
      updateData.status = ProofCandidateStatus.ready;
      if (!existing.readyAt) updateData.readyAt = new Date();
    } else if (body.status === "rejected" || body.status === "draft") {
      updateData.status = body.status as ProofCandidateStatus;
    } else if (body.status === "promoted") {
      return jsonError("Use POST /promote to promote", 400, "VALIDATION");
    }

    const updated = await db.proofCandidate.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(toItem(updated));
  });
}
