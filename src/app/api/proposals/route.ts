/**
 * GET /api/proposals — List proposals with filters.
 * POST /api/proposals — Create proposal (manual or from intake/pipeline).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProposalStatus, ProposalPriceType } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { parsePaginationParams, buildPaginationMeta, paginatedResponse } from "@/lib/pagination";

const STATUSES = ["draft", "ready", "sent", "viewed", "accepted", "rejected", "expired"] as const;
const PRICE_TYPES = ["fixed", "range", "hourly", "custom"] as const;

const PostSchema = z.object({
  intakeLeadId: z.string().cuid().optional().nullable(),
  pipelineLeadId: z.string().cuid().optional().nullable(),
  title: z.string().min(1, "Title required").max(500),
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
  priceCurrency: z.string().max(10).optional().default("CAD"),
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

export async function GET(req: NextRequest) {
  return withRouteTiming("GET /api/proposals", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const url = new URL(req.url);
    const status = url.searchParams.get("status") as ProposalStatus | null;
    const source = url.searchParams.get("source"); // intake | pipeline | all
    const search = url.searchParams.get("search") ?? url.searchParams.get("q");
    const pagination = parsePaginationParams(url.searchParams);

    const where: Record<string, unknown> = {};
    if (status && STATUSES.includes(status)) {
      where.status = status;
    }
    if (source === "intake") {
      where.intakeLeadId = { not: null };
    } else if (source === "pipeline") {
      where.pipelineLeadId = { not: null };
    }
    if (search?.trim()) {
      where.OR = [
        { title: { contains: search.trim(), mode: "insensitive" } },
        { clientName: { contains: search.trim(), mode: "insensitive" } },
        { company: { contains: search.trim(), mode: "insensitive" } },
      ];
    }

    const [proposals, total] = await Promise.all([
      db.proposal.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: pagination.skip,
        take: pagination.pageSize,
        include: {
          intakeLead: { select: { id: true, title: true, status: true } },
          pipelineLead: { select: { id: true, title: true, status: true } },
        },
      }),
      db.proposal.count({ where }),
    ]);

    const meta = buildPaginationMeta(total, pagination);
    return NextResponse.json(
      paginatedResponse(proposals.map((p) => safeProposal(p)), meta),
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  });
}

export async function POST(req: NextRequest) {
  return withRouteTiming("POST /api/proposals", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const raw = await req.json().catch(() => null);
    const parsed = PostSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join("; ");
      return jsonError(msg || "Invalid request body", 400, "VALIDATION");
    }
    const body = parsed.data;

    if (body.intakeLeadId) {
      const intake = await db.intakeLead.findUnique({ where: { id: body.intakeLeadId } });
      if (!intake) return jsonError("Intake lead not found", 404);
    }
    if (body.pipelineLeadId) {
      const lead = await db.lead.findUnique({ where: { id: body.pipelineLeadId } });
      if (!lead) return jsonError("Pipeline lead not found", 404);
    }

    const expiresAt = body.expiresAt?.trim() ? new Date(body.expiresAt) : null;

    const proposal = await db.proposal.create({
      data: {
        intakeLeadId: body.intakeLeadId ?? undefined,
        pipelineLeadId: body.pipelineLeadId ?? undefined,
        title: body.title,
        clientName: body.clientName ?? undefined,
        clientEmail: body.clientEmail?.trim() || undefined,
        company: body.company ?? undefined,
        summary: body.summary ?? undefined,
        scopeOfWork: body.scopeOfWork ?? undefined,
        deliverables: body.deliverables ?? undefined,
        timelineDays: body.timelineDays ?? undefined,
        priceType: body.priceType ? (body.priceType as ProposalPriceType) : undefined,
        priceMin: body.priceMin ?? undefined,
        priceMax: body.priceMax ?? undefined,
        priceCurrency: body.priceCurrency ?? "CAD",
        terms: body.terms ?? undefined,
        cta: body.cta ?? undefined,
        expiresAt: expiresAt ?? undefined,
        createdBy: session.user.id ?? undefined,
      },
      include: {
        intakeLead: { select: { id: true, title: true, status: true } },
        pipelineLead: { select: { id: true, title: true, status: true } },
      },
    });

    await db.proposalActivity.create({
      data: {
        proposalId: proposal.id,
        type: "created",
        message: "Proposal created",
      },
    });

    if (!proposal.intakeLeadId && !proposal.pipelineLeadId) {
      await db.proposalActivity.create({
        data: {
          proposalId: proposal.id,
          type: "note",
          message: "Warning: Proposal created without a linked lead source.",
        },
      });
    }

    if (proposal.intakeLeadId) {
      await db.intakeLead.update({
        where: { id: proposal.intakeLeadId },
        data: {
          proposalCount: { increment: 1 },
          latestProposalId: proposal.id,
        },
      });
    }
    if (proposal.pipelineLeadId) {
      await db.lead.update({
        where: { id: proposal.pipelineLeadId },
        data: { proposalCount: { increment: 1 } },
      });
    }

    return NextResponse.json(safeProposal(proposal), { status: 201 });
  });
}
