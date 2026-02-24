import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProofCandidateStatus, ProofCandidateSourceType, ProofCandidateTriggerType } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
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
  intakeLeadId: string | null;
  leadId: string | null;
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
    intakeLeadId: c.intakeLeadId ?? null,
    leadId: c.leadId ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    readiness,
  };
}

/** GET /api/proof-candidates */
export async function GET(req: NextRequest) {
  return withRouteTiming("GET /api/proof-candidates", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const sourceType = url.searchParams.get("sourceType");
    const triggerType = url.searchParams.get("triggerType");
    const search = url.searchParams.get("search")?.trim();
    const readyOnly = url.searchParams.get("readyOnly") === "true";

    const where: Record<string, unknown> = {};
    if (status && ["draft", "ready", "promoted", "rejected"].includes(status)) {
      where.status = status;
    }
    if (sourceType && ["intake_lead", "pipeline_lead", "manual"].includes(sourceType)) {
      where.sourceType = sourceType;
    }
    if (triggerType && ["github", "loom", "manual", "result_note"].includes(triggerType)) {
      where.triggerType = triggerType;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
        { proofSnippet: { contains: search, mode: "insensitive" } },
      ];
    }
    if (readyOnly) {
      where.status = ProofCandidateStatus.ready;
    }

    const list = await db.proofCandidate.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 100,
    });

    return NextResponse.json(list.map(toItem));
  });
}

const PostSchema = z.object({
  sourceType: z.enum(["intake_lead", "pipeline_lead", "manual"]),
  sourceId: z.string().max(100).optional().nullable(),
  intakeLeadId: z.string().max(100).optional().nullable(),
  leadId: z.string().max(100).optional().nullable(),
  title: z.string().min(1, "Title required").max(500),
  company: z.string().max(200).optional().nullable(),
  triggerType: z.enum(["github", "loom", "manual", "result_note"]),
  githubUrl: z.string().max(500).optional().nullable(),
  loomUrl: z.string().max(500).optional().nullable(),
  deliverySummary: z.string().max(5000).optional().nullable(),
  proofSnippet: z.string().max(5000).optional().nullable(),
  beforeState: z.string().max(2000).optional().nullable(),
  afterState: z.string().max(2000).optional().nullable(),
  metricLabel: z.string().max(100).optional().nullable(),
  metricValue: z.string().max(100).optional().nullable(),
  tags: z.array(z.string().max(50)).optional().default([]),
});

/** POST /api/proof-candidates */
export async function POST(req: NextRequest) {
  return withRouteTiming("POST /api/proof-candidates", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const raw = await req.json().catch(() => null);
    const parsed = PostSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join("; ");
      return jsonError(msg || "Invalid request body", 400, "VALIDATION");
    }
    const body = parsed.data;

    const candidate = await db.proofCandidate.create({
      data: {
        sourceType: body.sourceType as ProofCandidateSourceType,
        sourceId: body.sourceId ?? null,
        intakeLeadId: body.intakeLeadId ?? null,
        leadId: body.leadId ?? null,
        title: body.title,
        company: body.company ?? null,
        triggerType: body.triggerType as ProofCandidateTriggerType,
        githubUrl: body.githubUrl?.trim() || null,
        loomUrl: body.loomUrl?.trim() || null,
        deliverySummary: body.deliverySummary?.trim() || null,
        proofSnippet: body.proofSnippet?.trim() || null,
        beforeState: body.beforeState?.trim() || null,
        afterState: body.afterState?.trim() || null,
        metricLabel: body.metricLabel?.trim() || null,
        metricValue: body.metricValue?.trim() || null,
        tags: body.tags ?? [],
        status: ProofCandidateStatus.draft,
      },
    });

    return NextResponse.json(toItem(candidate), { status: 201 });
  });
}
