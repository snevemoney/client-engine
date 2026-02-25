/**
 * GET /api/delivery-projects/[id] — Project detail with milestones, checklist, activity.
 * PATCH /api/delivery-projects/[id] — Update project fields.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { computeProjectHealth, computeDeliveryCompletionReadiness } from "@/lib/delivery/readiness";

const PatchSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  clientName: z.string().max(200).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  summary: z.string().max(10000).optional().nullable(),
  owner: z.string().max(200).optional().nullable(),
  startDate: z.string().datetime().optional().nullable().or(z.literal("")),
  dueDate: z.string().datetime().optional().nullable().or(z.literal("")),
  deliveryNotes: z.string().max(10000).optional().nullable(),
  qaNotes: z.string().max(10000).optional().nullable(),
  handoffNotes: z.string().max(10000).optional().nullable(),
  githubUrl: z.string().url().optional().nullable().or(z.literal("")),
  loomUrl: z.string().url().optional().nullable().or(z.literal("")),
  artifactUrl: z.string().max(2000).optional().nullable().or(z.literal("")),
});

function safeProject(p: {
  id: string;
  status: string;
  title: string;
  clientName: string | null;
  company: string | null;
  summary: string | null;
  owner: string | null;
  startDate: Date | null;
  dueDate: Date | null;
  completedAt: Date | null;
  deliveryNotes: string | null;
  qaNotes: string | null;
  handoffNotes: string | null;
  githubUrl: string | null;
  loomUrl: string | null;
  artifactUrl: string | null;
  proofRequestedAt: Date | null;
  proofCapturedAt: Date | null;
  proofCandidateId: string | null;
  proposalId: string | null;
  intakeLeadId: string | null;
  pipelineLeadId: string | null;
  createdAt: Date;
  updatedAt: Date;
  handoffStartedAt?: Date | null;
  handoffCompletedAt?: Date | null;
  handoffOwner?: string | null;
  handoffSummary?: string | null;
  clientConfirmedAt?: Date | null;
  testimonialRequestedAt?: Date | null;
  testimonialReceivedAt?: Date | null;
  testimonialStatus?: string | null;
  testimonialQuote?: string | null;
  testimonialSourceUrl?: string | null;
  reviewRequestedAt?: Date | null;
  reviewReceivedAt?: Date | null;
  reviewPlatform?: string | null;
  reviewUrl?: string | null;
  referralRequestedAt?: Date | null;
  referralReceivedAt?: Date | null;
  referralStatus?: string | null;
  referralNotes?: string | null;
  retentionStatus?: string | null;
  retentionNextFollowUpAt?: Date | null;
  retentionLastContactedAt?: Date | null;
  retentionFollowUpCount?: number | null;
  retentionOutcome?: string | null;
  upsellOpportunity?: string | null;
  upsellValueEstimate?: number | null;
  postDeliveryHealth?: string | null;
}) {
  const health = computeProjectHealth({ status: p.status, dueDate: p.dueDate });
  return {
    id: p.id,
    status: p.status ?? "not_started",
    title: p.title ?? "",
    clientName: p.clientName ?? null,
    company: p.company ?? null,
    summary: p.summary ?? null,
    owner: p.owner ?? null,
    startDate: p.startDate?.toISOString() ?? null,
    dueDate: p.dueDate?.toISOString() ?? null,
    completedAt: p.completedAt?.toISOString() ?? null,
    deliveryNotes: p.deliveryNotes ?? null,
    qaNotes: p.qaNotes ?? null,
    handoffNotes: p.handoffNotes ?? null,
    githubUrl: p.githubUrl ?? null,
    loomUrl: p.loomUrl ?? null,
    artifactUrl: p.artifactUrl ?? null,
    proofRequestedAt: p.proofRequestedAt?.toISOString() ?? null,
    proofCapturedAt: p.proofCapturedAt?.toISOString() ?? null,
    proofCandidateId: p.proofCandidateId ?? null,
    proposalId: p.proposalId ?? null,
    intakeLeadId: p.intakeLeadId ?? null,
    pipelineLeadId: p.pipelineLeadId ?? null,
    health,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    handoffStartedAt: p.handoffStartedAt?.toISOString() ?? null,
    handoffCompletedAt: p.handoffCompletedAt?.toISOString() ?? null,
    handoffOwner: p.handoffOwner ?? null,
    handoffSummary: p.handoffSummary ?? null,
    clientConfirmedAt: p.clientConfirmedAt?.toISOString() ?? null,
    testimonialRequestedAt: p.testimonialRequestedAt?.toISOString() ?? null,
    testimonialReceivedAt: p.testimonialReceivedAt?.toISOString() ?? null,
    testimonialStatus: p.testimonialStatus ?? "none",
    testimonialQuote: p.testimonialQuote ?? null,
    testimonialSourceUrl: p.testimonialSourceUrl ?? null,
    reviewRequestedAt: p.reviewRequestedAt?.toISOString() ?? null,
    reviewReceivedAt: p.reviewReceivedAt?.toISOString() ?? null,
    reviewPlatform: p.reviewPlatform ?? null,
    reviewUrl: p.reviewUrl ?? null,
    referralRequestedAt: p.referralRequestedAt?.toISOString() ?? null,
    referralReceivedAt: p.referralReceivedAt?.toISOString() ?? null,
    referralStatus: p.referralStatus ?? "none",
    referralNotes: p.referralNotes ?? null,
    retentionStatus: p.retentionStatus ?? "none",
    retentionNextFollowUpAt: p.retentionNextFollowUpAt?.toISOString() ?? null,
    retentionLastContactedAt: p.retentionLastContactedAt?.toISOString() ?? null,
    retentionFollowUpCount: p.retentionFollowUpCount ?? 0,
    retentionOutcome: p.retentionOutcome ?? null,
    upsellOpportunity: p.upsellOpportunity ?? null,
    upsellValueEstimate: p.upsellValueEstimate ?? null,
    postDeliveryHealth: p.postDeliveryHealth ?? "green",
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("GET /api/delivery-projects/[id]", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const project = await db.deliveryProject.findUnique({
      where: { id },
      include: {
        milestones: { orderBy: { sortOrder: "asc" } },
        checklistItems: { orderBy: { sortOrder: "asc" } },
        activities: { orderBy: { createdAt: "desc" }, take: 50 },
        proposal: { select: { id: true, title: true, status: true } },
        intakeLead: { select: { id: true, title: true, status: true } },
      },
    });

    if (!project) return jsonError("Project not found", 404);

    const readiness = computeDeliveryCompletionReadiness(
      project,
      project.checklistItems,
      project.milestones
    );

    return NextResponse.json({
      ...safeProject(project),
      milestones: project.milestones.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description ?? null,
        status: m.status,
        sortOrder: m.sortOrder,
        dueAt: m.dueAt?.toISOString() ?? null,
        completedAt: m.completedAt?.toISOString() ?? null,
      })),
      checklistItems: project.checklistItems.map((c) => ({
        id: c.id,
        category: c.category,
        label: c.label,
        isRequired: c.isRequired,
        isDone: c.isDone,
        doneAt: c.doneAt?.toISOString() ?? null,
        sortOrder: c.sortOrder,
      })),
      activities: project.activities.map((a) => ({
        id: a.id,
        type: a.type,
        message: a.message ?? null,
        metaJson: a.metaJson ?? null,
        createdAt: a.createdAt.toISOString(),
      })),
      proposal: project.proposal
        ? { id: project.proposal.id, title: project.proposal.title, status: project.proposal.status }
        : null,
      intakeLead: project.intakeLead
        ? { id: project.intakeLead.id, title: project.intakeLead.title, status: project.intakeLead.status }
        : null,
      readiness: {
        canComplete: readiness.canComplete,
        reasons: readiness.reasons,
        warnings: readiness.warnings,
      },
    });
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("PATCH /api/delivery-projects/[id]", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const existing = await db.deliveryProject.findUnique({ where: { id } });
    if (!existing) return jsonError("Project not found", 404);

    const raw = await req.json().catch(() => null);
    const parsed = PatchSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join("; ");
      return jsonError(msg || "Invalid request body", 400, "VALIDATION");
    }
    const body = parsed.data;

    const data: Record<string, unknown> = {};
    if (body.title != null) data.title = body.title;
    if (body.clientName !== undefined) data.clientName = body.clientName ?? null;
    if (body.company !== undefined) data.company = body.company ?? null;
    if (body.summary !== undefined) data.summary = body.summary ?? null;
    if (body.owner !== undefined) data.owner = body.owner ?? null;
    if (body.startDate !== undefined) {
      const v = body.startDate?.trim();
      data.startDate = v ? new Date(v) : null;
    }
    if (body.dueDate !== undefined) {
      const v = body.dueDate?.trim();
      data.dueDate = v ? new Date(v) : null;
    }
    if (body.deliveryNotes !== undefined) data.deliveryNotes = body.deliveryNotes ?? null;
    if (body.qaNotes !== undefined) data.qaNotes = body.qaNotes ?? null;
    if (body.handoffNotes !== undefined) data.handoffNotes = body.handoffNotes ?? null;
    if (body.githubUrl !== undefined) data.githubUrl = body.githubUrl?.trim() || null;
    if (body.loomUrl !== undefined) data.loomUrl = body.loomUrl?.trim() || null;
    if (body.artifactUrl !== undefined) data.artifactUrl = body.artifactUrl?.trim() || null;

    const project = await db.deliveryProject.update({
      where: { id },
      data,
    });

    await db.deliveryActivity.create({
      data: {
        deliveryProjectId: id,
        type: "note",
        message: "Project updated",
      },
    });

    return NextResponse.json(safeProject(project));
  });
}
