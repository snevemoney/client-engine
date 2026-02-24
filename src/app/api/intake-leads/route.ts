import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { IntakeLeadSource, IntakeLeadUrgency, IntakeLeadStatus } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { getStartOfDay } from "@/lib/followup/dates";

const SOURCES = ["upwork", "linkedin", "referral", "inbound", "rss", "other"] as const;
const URGENCIES = ["low", "medium", "high"] as const;

const PostSchema = z.object({
  source: z.enum(SOURCES),
  title: z.string().min(1, "Title required").max(500),
  company: z.string().max(200).optional().nullable(),
  contactName: z.string().max(200).optional().nullable(),
  contactEmail: z.union([z.string().email(), z.literal("")]).optional().nullable(),
  link: z.string().url().optional().nullable().or(z.literal("")),
  summary: z.string().min(1, "Summary required").max(10000),
  budgetMin: z.number().int().min(0).optional().nullable(),
  budgetMax: z.number().int().min(0).optional().nullable(),
  urgency: z.enum(URGENCIES).optional().default("medium"),
  tags: z.array(z.string().max(50)).optional().default([]),
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
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
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
    tags: Array.isArray(lead.tags) ? lead.tags : [],
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  return withRouteTiming("GET /api/intake-leads", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const source = url.searchParams.get("source");
    const filter = url.searchParams.get("filter");
    const search = url.searchParams.get("search") ?? url.searchParams.get("q");
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") ?? "100", 10) || 100));

    const filterWhere: Record<string, unknown> = {};
    if (filter === "needs-score") {
      filterWhere.status = { notIn: [IntakeLeadStatus.won, IntakeLeadStatus.lost, IntakeLeadStatus.archived] };
      filterWhere.score = null;
    } else if (filter === "ready") {
      filterWhere.status = { in: ["qualified", "proposal_drafted"] };
      filterWhere.promotedLeadId = null;
      filterWhere.title = { not: "" };
      filterWhere.summary = { not: "" };
    } else if (filter === "followup-overdue") {
      const startToday = getStartOfDay(new Date());
      filterWhere.status = "sent";
      filterWhere.OR = [
        { followUpDueAt: { lt: startToday } },
        { nextActionDueAt: { lt: startToday } },
      ];
    } else if (filter === "won-missing-proof") {
      filterWhere.status = "won";
      filterWhere.proofCandidates = { none: {} };
      filterWhere.proofRecords = { none: {} };
    } else if (status) {
      filterWhere.status = status;
    }
    if (source) filterWhere.source = source;

    const searchWhere = search?.trim()
      ? {
          OR: [
            { title: { contains: search.trim(), mode: "insensitive" as const } },
            { summary: { contains: search.trim(), mode: "insensitive" as const } },
            { company: { contains: search.trim(), mode: "insensitive" as const } },
          ],
        }
      : {};

    const where =
      Object.keys(searchWhere).length > 0 && Object.keys(filterWhere).length > 0
        ? { AND: [filterWhere, searchWhere] }
        : Object.keys(searchWhere).length > 0
          ? searchWhere
          : filterWhere;

    const leads = await db.intakeLead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json(
      leads.map((l) => safeLead(l)),
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  });
}

export async function POST(req: NextRequest) {
  return withRouteTiming("POST /api/intake-leads", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const raw = await req.json().catch(() => null);
    const parsed = PostSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join("; ");
      return jsonError(msg || "Invalid request body", 400, "VALIDATION");
    }
    const body = parsed.data;

    const lead = await db.intakeLead.create({
      data: {
        source: body.source as IntakeLeadSource,
        title: body.title,
        company: body.company ?? undefined,
        contactName: body.contactName ?? undefined,
        contactEmail: body.contactEmail?.trim() || undefined,
        link: body.link?.trim() || undefined,
        summary: body.summary,
        budgetMin: body.budgetMin ?? undefined,
        budgetMax: body.budgetMax ?? undefined,
        urgency: (body.urgency as IntakeLeadUrgency) ?? "medium",
        tags: body.tags ?? [],
      },
    });

    return NextResponse.json(safeLead(lead), { status: 201 });
  });
}
