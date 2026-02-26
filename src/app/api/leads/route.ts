import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { LeadStatus } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

const PostLeadSchema = z.object({
  title: z.string().min(1).max(500),
  source: z.string().max(100).optional().default("manual"),
  sourceUrl: z.string().max(2000).optional().nullable(),
  description: z.string().max(10000).optional().nullable(),
  budget: z.string().max(200).optional().nullable(),
  timeline: z.string().max(200).optional().nullable(),
  platform: z.string().max(200).optional().nullable(),
  techStack: z.array(z.string()).optional().default([]),
  contactName: z.string().max(200).optional().nullable(),
  contactEmail: z.string().max(200).optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
});

export async function GET(req: NextRequest) {
  return withRouteTiming("GET /api/leads", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const url = new URL(req.url);
    const status = url.searchParams.get("status") as LeadStatus | null;
    const source = url.searchParams.get("source");
    const search = url.searchParams.get("q");
    const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get("limit") ?? "500", 10) || 500));

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (source) where.source = source;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const leads = await db.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { _count: { select: { artifacts: true } } },
    });

    return NextResponse.json(leads, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  });
}

export async function POST(req: NextRequest) {
  return withRouteTiming("POST /api/leads", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const raw = await req.json().catch(() => null);
    const parsed = PostLeadSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join("; ");
      return jsonError(msg || "Invalid request body", 400, "VALIDATION");
    }
    const body = parsed.data;

    let lead;
    try {
      lead = await db.lead.create({
        data: {
          title: body.title,
          source: body.source,
          sourceUrl: body.sourceUrl ?? undefined,
          description: body.description ?? undefined,
          budget: body.budget ?? undefined,
          timeline: body.timeline ?? undefined,
          platform: body.platform ?? undefined,
          techStack: body.techStack,
          contactName: body.contactName ?? undefined,
          contactEmail: body.contactEmail ?? undefined,
          tags: body.tags,
        },
      });
    } catch (e) {
      console.error("[api:error] POST /api/leads create failed", e);
      return jsonError("Failed to create lead", 500, "DB_ERROR");
    }

    void (async () => {
      try {
        const { runPipelineIfEligible } = await import("@/lib/pipeline/orchestrator");
        await runPipelineIfEligible(lead.id, "lead_created");
      } catch (err) {
        console.error("[api:error] POST /api/leads pipeline run failed", { leadId: lead.id }, err);
      }
    })();

    return NextResponse.json(lead, { status: 201 });
  });
}
