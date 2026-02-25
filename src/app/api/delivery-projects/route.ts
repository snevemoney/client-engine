/**
 * GET /api/delivery-projects — List with filters.
 * POST /api/delivery-projects — Create manual or from proposal.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DeliveryProjectStatus } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { parsePaginationParams, buildPaginationMeta, paginatedResponse } from "@/lib/pagination";
import { computeProjectHealth } from "@/lib/delivery/readiness";
import { buildDefaultDeliveryChecklist, buildDefaultMilestonesFromProposal } from "@/lib/delivery/templates";

const STATUSES = ["not_started", "kickoff", "in_progress", "qa", "blocked", "completed", "archived"] as const;

const PostSchema = z.object({
  proposalId: z.string().cuid().optional().nullable(),
  intakeLeadId: z.string().cuid().optional().nullable(),
  pipelineLeadId: z.string().cuid().optional().nullable(),
  title: z.string().min(1, "Title required").max(500),
  clientName: z.string().max(200).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  summary: z.string().max(10000).optional().nullable(),
  owner: z.string().max(200).optional().nullable(),
  startDate: z.string().datetime().optional().nullable().or(z.literal("")),
  dueDate: z.string().datetime().optional().nullable().or(z.literal("")),
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
  githubUrl: string | null;
  loomUrl: string | null;
  proofRequestedAt: Date | null;
  proofCapturedAt: Date | null;
  proofCandidateId: string | null;
  proposalId: string | null;
  intakeLeadId: string | null;
  pipelineLeadId: string | null;
  createdAt: Date;
  updatedAt: Date;
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
    githubUrl: p.githubUrl ?? null,
    loomUrl: p.loomUrl ?? null,
    proofRequestedAt: p.proofRequestedAt?.toISOString() ?? null,
    proofCapturedAt: p.proofCapturedAt?.toISOString() ?? null,
    proofCandidateId: p.proofCandidateId ?? null,
    proposalId: p.proposalId ?? null,
    intakeLeadId: p.intakeLeadId ?? null,
    pipelineLeadId: p.pipelineLeadId ?? null,
    health,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  return withRouteTiming("GET /api/delivery-projects", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const url = new URL(req.url);
    const status = url.searchParams.get("status") as DeliveryProjectStatus | null;
    const health = url.searchParams.get("health");
    const due = url.searchParams.get("due"); // soon | overdue
    const search = url.searchParams.get("search") ?? url.searchParams.get("q");
    const pagination = parsePaginationParams(url.searchParams);

    const where: Record<string, unknown> = {};
    if (status && STATUSES.includes(status)) {
      where.status = status;
    }
    if (search?.trim()) {
      where.OR = [
        { title: { contains: search.trim(), mode: "insensitive" } },
        { clientName: { contains: search.trim(), mode: "insensitive" } },
        { company: { contains: search.trim(), mode: "insensitive" } },
      ];
    }

    const projects = await db.deliveryProject.findMany({
      where,
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      take: 500,
    });

    let filtered = projects.map((p) => safeProject(p));
    if (health === "due_soon" || health === "overdue") {
      filtered = filtered.filter((p) => p.health === health);
    }
    if (due === "soon") {
      filtered = filtered.filter((p) => p.health === "due_soon");
    } else if (due === "overdue") {
      filtered = filtered.filter((p) => p.health === "overdue");
    }

    const total = filtered.length;
    const pageItems = filtered.slice(pagination.skip, pagination.skip + pagination.pageSize);
    const meta = buildPaginationMeta(total, pagination);
    return NextResponse.json(
      paginatedResponse(pageItems, meta),
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  });
}

export async function POST(req: NextRequest) {
  return withRouteTiming("POST /api/delivery-projects", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const raw = await req.json().catch(() => null);
    const parsed = PostSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join("; ");
      return jsonError(msg || "Invalid request body", 400, "VALIDATION");
    }
    const body = parsed.data;

    let proposal: { deliverables?: unknown } | null = null;
    if (body.proposalId) {
      proposal = await db.proposal.findUnique({ where: { id: body.proposalId } });
      if (!proposal) return jsonError("Proposal not found", 404);
    }
    if (body.intakeLeadId) {
      const intake = await db.intakeLead.findUnique({ where: { id: body.intakeLeadId } });
      if (!intake) return jsonError("Intake lead not found", 404);
    }
    if (body.pipelineLeadId) {
      const lead = await db.lead.findUnique({ where: { id: body.pipelineLeadId } });
      if (!lead) return jsonError("Pipeline lead not found", 404);
    }

    const startDate = body.startDate?.trim() ? new Date(body.startDate) : null;
    const dueDate = body.dueDate?.trim() ? new Date(body.dueDate) : null;

    const project = await db.deliveryProject.create({
      data: {
        proposalId: body.proposalId ?? undefined,
        intakeLeadId: body.intakeLeadId ?? undefined,
        pipelineLeadId: body.pipelineLeadId ?? undefined,
        title: body.title,
        clientName: body.clientName ?? undefined,
        company: body.company ?? undefined,
        summary: body.summary ?? undefined,
        owner: body.owner ?? undefined,
        startDate: startDate ?? undefined,
        dueDate: dueDate ?? undefined,
      },
    });

    const checklist = buildDefaultDeliveryChecklist();
    const milestones = buildDefaultMilestonesFromProposal(proposal);

    for (const item of checklist) {
      await db.deliveryChecklistItem.create({
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
      await db.deliveryMilestone.create({
        data: {
          deliveryProjectId: project.id,
          title: m.title,
          description: m.description ?? undefined,
          sortOrder: m.sortOrder ?? 0,
        },
      });
    }
    await db.deliveryActivity.create({
      data: {
        deliveryProjectId: project.id,
        type: "created",
        message: body.proposalId ? "Created from accepted proposal" : "Manual project created",
      },
    });

    return NextResponse.json(safeProject(project), { status: 201 });
  });
}
