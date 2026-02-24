/**
 * GET /api/proposals/[id] — Proposal detail with versions + activity.
 * PATCH /api/proposals/[id] — Update proposal fields.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProposalPriceType } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { computeProposalReadiness } from "@/lib/proposals/readiness";
import { buildProposalSnapshot, nextProposalVersion } from "@/lib/proposals/versioning";

const PRICE_TYPES = ["fixed", "range", "hourly", "custom"] as const;

const PatchSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  clientName: z.string().max(200).optional().nullable(),
  clientEmail: z.string().email().optional().nullable().or(z.literal("")),
  company: z.string().max(200).optional().nullable(),
  summary: z.string().max(10000).optional().nullable(),
  scopeOfWork: z.string().max(50000).optional().nullable(),
  deliverables: z.union([z.array(z.string()), z.array(z.record(z.string(), z.unknown()))]).optional().nullable(),
  timelineDays: z.number().int().min(0).optional().nullable(),
  priceType: z.enum(PRICE_TYPES).optional().nullable(),
  priceMin: z.number().int().min(0).optional().nullable(),
  priceMax: z.number().int().min(0).optional().nullable(),
  priceCurrency: z.string().max(10).optional(),
  terms: z.string().max(5000).optional().nullable(),
  cta: z.string().max(2000).optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable().or(z.literal("")),
});

function safeProposal(p: {
  id: string;
  status: string;
  title: string;
  clientName: string | null;
  clientEmail: string | null;
  company: string | null;
  summary: string | null;
  scopeOfWork: string | null;
  deliverables: unknown;
  timelineDays: number | null;
  priceType: string | null;
  priceMin: number | null;
  priceMax: number | null;
  priceCurrency: string;
  terms: string | null;
  cta: string | null;
  version: number;
  sentAt: Date | null;
  viewedAt: Date | null;
  acceptedAt: Date | null;
  rejectedAt: Date | null;
  expiresAt: Date | null;
  lastEditedAt: Date | null;
  intakeLeadId: string | null;
  pipelineLeadId: string | null;
  createdAt: Date;
  updatedAt: Date;
  intakeLead?: { id: string; title: string; status: string } | null;
  pipelineLead?: { id: string; title: string; status: string } | null;
}) {
  return {
    id: p.id,
    status: p.status ?? "draft",
    title: p.title ?? "",
    clientName: p.clientName ?? null,
    clientEmail: p.clientEmail ?? null,
    company: p.company ?? null,
    summary: p.summary ?? null,
    scopeOfWork: p.scopeOfWork ?? null,
    deliverables: p.deliverables ?? null,
    timelineDays: p.timelineDays ?? null,
    priceType: p.priceType ?? null,
    priceMin: p.priceMin ?? null,
    priceMax: p.priceMax ?? null,
    priceCurrency: p.priceCurrency ?? "CAD",
    terms: p.terms ?? null,
    cta: p.cta ?? null,
    version: p.version ?? 1,
    sentAt: p.sentAt?.toISOString() ?? null,
    viewedAt: p.viewedAt?.toISOString() ?? null,
    acceptedAt: p.acceptedAt?.toISOString() ?? null,
    rejectedAt: p.rejectedAt?.toISOString() ?? null,
    expiresAt: p.expiresAt?.toISOString() ?? null,
    lastEditedAt: p.lastEditedAt?.toISOString() ?? null,
    intakeLeadId: p.intakeLeadId ?? null,
    pipelineLeadId: p.pipelineLeadId ?? null,
    intakeLead: p.intakeLead
      ? { id: p.intakeLead.id, title: p.intakeLead.title, status: p.intakeLead.status }
      : null,
    pipelineLead: p.pipelineLead
      ? { id: p.pipelineLead.id, title: p.pipelineLead.title, status: p.pipelineLead.status }
      : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("GET /api/proposals/[id]", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const proposal = await db.proposal.findUnique({
      where: { id },
      include: {
        intakeLead: { select: { id: true, title: true, status: true } },
        pipelineLead: { select: { id: true, title: true, status: true } },
        versions: { orderBy: { version: "desc" }, take: 20 },
        activities: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });

    if (!proposal) return jsonError("Proposal not found", 404);

    const readiness = computeProposalReadiness(proposal);

    return NextResponse.json({
      ...safeProposal(proposal),
      versions: proposal.versions.map((v) => ({
        id: v.id,
        version: v.version,
        snapshotJson: v.snapshotJson,
        changeNote: v.changeNote ?? null,
        createdAt: v.createdAt.toISOString(),
      })),
      activities: proposal.activities.map((a) => ({
        id: a.id,
        type: a.type,
        message: a.message ?? null,
        metaJson: a.metaJson ?? null,
        createdAt: a.createdAt.toISOString(),
      })),
      readiness: {
        isReady: readiness.isReady,
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
  return withRouteTiming("PATCH /api/proposals/[id]", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const existing = await db.proposal.findUnique({ where: { id } });
    if (!existing) return jsonError("Proposal not found", 404);

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
    if (body.clientEmail !== undefined) data.clientEmail = body.clientEmail?.trim() || null;
    if (body.company !== undefined) data.company = body.company ?? null;
    if (body.summary !== undefined) data.summary = body.summary ?? null;
    if (body.scopeOfWork !== undefined) data.scopeOfWork = body.scopeOfWork ?? null;
    if (body.deliverables !== undefined) data.deliverables = body.deliverables ?? null;
    if (body.timelineDays !== undefined) data.timelineDays = body.timelineDays ?? null;
    if (body.priceType !== undefined) data.priceType = body.priceType ? (body.priceType as ProposalPriceType) : null;
    if (body.priceMin !== undefined) data.priceMin = body.priceMin ?? null;
    if (body.priceMax !== undefined) data.priceMax = body.priceMax ?? null;
    if (body.priceCurrency != null) data.priceCurrency = body.priceCurrency;
    if (body.terms !== undefined) data.terms = body.terms ?? null;
    if (body.cta !== undefined) data.cta = body.cta ?? null;
    if (body.expiresAt !== undefined) {
      const v = body.expiresAt?.trim();
      data.expiresAt = v ? new Date(v) : null;
    }
    data.lastEditedAt = new Date();

    const proposal = await db.proposal.update({
      where: { id },
      data,
      include: {
        intakeLead: { select: { id: true, title: true, status: true } },
        pipelineLead: { select: { id: true, title: true, status: true } },
      },
    });

    await db.proposalActivity.create({
      data: {
        proposalId: id,
        type: "edited",
        message: "Proposal updated",
      },
    });

    return NextResponse.json(safeProposal(proposal));
  });
}
