import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { IntakeLeadSource, IntakeLeadStatus, IntakeLeadUrgency } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { computeIntakePromotionReadiness } from "@/lib/intake-lead/readiness";

const STATUSES = ["new", "qualified", "proposal_drafted", "sent", "won", "lost", "archived"] as const;
const SOURCES = ["upwork", "linkedin", "referral", "inbound", "rss", "other"] as const;
const URGENCIES = ["low", "medium", "high"] as const;

const PatchSchema = z.object({
  source: z.enum(SOURCES).optional(),
  title: z.string().min(1).max(500).optional(),
  company: z.string().max(200).optional().nullable(),
  contactName: z.string().max(200).optional().nullable(),
  contactEmail: z.union([z.string().email(), z.literal("")]).optional().nullable(),
  link: z.union([z.string().url(), z.literal("")]).optional().nullable(),
  summary: z.string().max(10000).optional(),
  budgetMin: z.number().int().min(0).optional().nullable(),
  budgetMax: z.number().int().min(0).optional().nullable(),
  urgency: z.enum(URGENCIES).optional(),
  status: z.enum(STATUSES).optional(),
  score: z.number().int().min(0).max(100).optional().nullable(),
  scoreReason: z.string().max(2000).optional().nullable(),
  nextAction: z.string().max(2000).optional().nullable(),
  nextActionDueAt: z.string().datetime().optional().nullable().or(z.literal("")),
  tags: z.array(z.string().max(50)).optional(),
});

function safeLead(lead: {
  id: string;
  source: string;
  title: string;
  company: string | null;
  contactName: string | null;
  contactEmail: string | null;
  link: string | null;
  summary: string;
  budgetMin: number | null;
  budgetMax: number | null;
  urgency: string;
  status: string;
  score: number | null;
  scoreReason: string | null;
  nextAction: string | null;
  nextActionDueAt: Date | null;
  promotedLeadId: string | null;
  proposalSentAt: Date | null;
  followUpDueAt: Date | null;
  outcomeReason: string | null;
  lastContactedAt: Date | null;
  followUpCompletedAt: Date | null;
  followUpCount: number;
  githubUrl: string | null;
  loomUrl: string | null;
  deliverySummary: string | null;
  deliveryCompletedAt: Date | null;
  proofCandidateCount: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  promotedLead?: { id: string; title: string; status: string } | null;
}) {
  return {
    id: lead.id,
    source: lead.source,
    title: lead.title ?? "",
    company: lead.company ?? null,
    contactName: lead.contactName ?? null,
    contactEmail: lead.contactEmail ?? null,
    link: lead.link ?? null,
    summary: lead.summary ?? "",
    budgetMin: lead.budgetMin ?? null,
    budgetMax: lead.budgetMax ?? null,
    urgency: lead.urgency ?? "medium",
    status: lead.status ?? "new",
    score: lead.score ?? null,
    scoreReason: lead.scoreReason ?? null,
    nextAction: lead.nextAction ?? null,
    nextActionDueAt: lead.nextActionDueAt?.toISOString() ?? null,
    promotedLeadId: lead.promotedLeadId ?? null,
    proposalSentAt: lead.proposalSentAt?.toISOString() ?? null,
    followUpDueAt: lead.followUpDueAt?.toISOString() ?? null,
    outcomeReason: lead.outcomeReason ?? null,
    lastContactedAt: lead.lastContactedAt?.toISOString() ?? null,
    followUpCompletedAt: lead.followUpCompletedAt?.toISOString() ?? null,
    followUpCount: lead.followUpCount ?? 0,
    githubUrl: lead.githubUrl ?? null,
    loomUrl: lead.loomUrl ?? null,
    deliverySummary: lead.deliverySummary ?? null,
    deliveryCompletedAt: lead.deliveryCompletedAt?.toISOString() ?? null,
    proofCandidateCount: lead.proofCandidateCount ?? 0,
    proposalCount: (lead as { proposalCount?: number }).proposalCount ?? 0,
    latestProposalId: (lead as { latestProposalId?: string | null }).latestProposalId ?? null,
    promotedLead: lead.promotedLead
      ? { id: lead.promotedLead.id, title: lead.promotedLead.title, status: lead.promotedLead.status }
      : null,
    tags: Array.isArray(lead.tags) ? lead.tags : [],
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };
}

function safeActivity(a: { id: string; type: string; content: string; metadataJson: unknown; createdAt: Date }) {
  return {
    id: a.id,
    type: a.type,
    content: a.content ?? "",
    metadataJson: a.metadataJson ?? null,
    createdAt: a.createdAt.toISOString(),
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("GET /api/intake-leads/[id]", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const lead = await db.intakeLead.findUnique({
      where: { id },
      include: {
        activities: { orderBy: { createdAt: "desc" }, take: 100 },
        promotedLead: { select: { id: true, title: true, status: true } },
        latestProposal: { select: { id: true, title: true, status: true } },
      },
    });

    if (!lead) return jsonError("Lead not found", 404);

    const readiness = computeIntakePromotionReadiness(lead);

    const out = safeLead(lead);
    return NextResponse.json({
      ...out,
      latestProposal: lead.latestProposal
        ? { id: lead.latestProposal.id, title: lead.latestProposal.title, status: lead.latestProposal.status }
        : null,
      activities: lead.activities.map(safeActivity),
      promotionReadiness: {
        isReadyToPromote: readiness.isReadyToPromote,
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
  return withRouteTiming("PATCH /api/intake-leads/[id]", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const existing = await db.intakeLead.findUnique({ where: { id } });
    if (!existing) return jsonError("Lead not found", 404);

    const raw = await req.json().catch(() => null);
    const parsed = PatchSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join("; ");
      return jsonError(msg || "Invalid request body", 400, "VALIDATION");
    }
    const body = parsed.data;

    const data: Record<string, unknown> = {};
    if (body.source != null) data.source = body.source as IntakeLeadSource;
    if (body.title != null) data.title = body.title;
    if (body.company !== undefined) data.company = body.company || null;
    if (body.contactName !== undefined) data.contactName = body.contactName || null;
    if (body.contactEmail !== undefined) data.contactEmail = body.contactEmail?.trim() || null;
    if (body.link !== undefined) data.link = body.link?.trim() || null;
    if (body.summary != null) data.summary = body.summary;
    if (body.budgetMin !== undefined) data.budgetMin = body.budgetMin;
    if (body.budgetMax !== undefined) data.budgetMax = body.budgetMax;
    if (body.urgency != null) data.urgency = body.urgency as IntakeLeadUrgency;
    if (body.status != null) data.status = body.status as IntakeLeadStatus;
    if (body.score !== undefined) data.score = body.score;
    if (body.scoreReason !== undefined) data.scoreReason = body.scoreReason;
    if (body.nextAction !== undefined) data.nextAction = body.nextAction;
    if (body.nextActionDueAt !== undefined) {
      const v = body.nextActionDueAt?.trim();
      data.nextActionDueAt = v ? new Date(v) : null;
    }
    if (body.tags != null) data.tags = body.tags;

    const lead = await db.intakeLead.update({
      where: { id },
      data,
    });

    return NextResponse.json(safeLead(lead));
  });
}
