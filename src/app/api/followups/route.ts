import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { IntakeLeadStatus } from "@prisma/client";
import { withRouteTiming } from "@/lib/api-utils";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/pagination";
import { classifyFollowUpBucket, isValidDate, type Bucket } from "@/lib/followup/dates";

export type FollowUpItem = {
  id: string;
  itemType: "intake" | "pipeline";
  title: string;
  company: string | null;
  source: string;
  status: string;
  score: number | null;
  nextAction: string | null;
  nextActionDueAt: string | null;
  followUpDueAt: string | null;
  promotedLeadId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  lastContactedAt: string | null;
  followUpCount: number;
  followUpCompletedAt: string | null;
};

function toIntakeItem(row: {
  id: string;
  title: string;
  company: string | null;
  source: string;
  status: string;
  score: number | null;
  nextAction: string | null;
  nextActionDueAt: Date | null;
  followUpDueAt: Date | null;
  promotedLeadId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  lastContactedAt: Date | null;
  followUpCount: number;
  followUpCompletedAt: Date | null;
}): FollowUpItem {
  return {
    id: row.id,
    itemType: "intake",
    title: row.title ?? "",
    company: row.company ?? null,
    source: row.source ?? "other",
    status: row.status ?? "new",
    score: row.score ?? null,
    nextAction: row.nextAction ?? null,
    nextActionDueAt: row.nextActionDueAt?.toISOString() ?? null,
    followUpDueAt: row.followUpDueAt?.toISOString() ?? null,
    promotedLeadId: row.promotedLeadId ?? null,
    contactName: row.contactName ?? null,
    contactEmail: row.contactEmail ?? null,
    lastContactedAt: row.lastContactedAt?.toISOString() ?? null,
    followUpCount: row.followUpCount ?? 0,
    followUpCompletedAt: row.followUpCompletedAt?.toISOString() ?? null,
  };
}

function toPipelineItem(lead: {
  id: string;
  title: string;
  source: string;
  status: string;
  score: number | null;
  nextAction: string | null;
  nextActionDueAt: Date | null;
  contactName: string | null;
  contactEmail: string | null;
  lastContactAt: Date | null;
  followUpCount: number;
}): FollowUpItem {
  return {
    id: lead.id,
    itemType: "pipeline",
    title: lead.title ?? "",
    company: null,
    source: lead.source ?? "other",
    status: lead.status ?? "NEW",
    score: lead.score ?? null,
    nextAction: lead.nextAction ?? null,
    nextActionDueAt: lead.nextActionDueAt?.toISOString() ?? null,
    followUpDueAt: null,
    promotedLeadId: null,
    contactName: lead.contactName ?? null,
    contactEmail: lead.contactEmail ?? null,
    lastContactedAt: lead.lastContactAt?.toISOString() ?? null,
    followUpCount: lead.followUpCount ?? 0,
    followUpCompletedAt: null,
  };
}

/** GET /api/followups */
export async function GET(req: NextRequest) {
  return withRouteTiming("GET /api/followups", async () => {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const bucket = url.searchParams.get("bucket") as Bucket | "all" | null;
    const days = Math.min(30, Math.max(1, parseInt(url.searchParams.get("days") ?? "7", 10) || 7));
    const search = url.searchParams.get("search")?.trim();
    const source = url.searchParams.get("source")?.trim();
    const statusFilter = url.searchParams.get("status")?.trim();
    const pagination = parsePaginationParams(url.searchParams);

    const now = new Date();

    const where: Record<string, unknown> = {
      OR: [
        { nextActionDueAt: { not: null } },
        { followUpDueAt: { not: null } },
      ],
    };
    if (!statusFilter) {
      where.status = { notIn: [IntakeLeadStatus.won, IntakeLeadStatus.lost] };
    } else {
      where.status = statusFilter;
    }
    if (search) {
      where.AND = [
        {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { company: { contains: search, mode: "insensitive" } },
            { summary: { contains: search, mode: "insensitive" } },
          ],
        },
      ];
    }
    if (source) where.source = source;

    const pipelineWhere: Record<string, unknown> = {
      nextActionDueAt: { not: null },
      status: { notIn: ["REJECTED", "SHIPPED"] },
      dealOutcome: { not: "won" },
    };
    if (search) {
      pipelineWhere.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }
    if (source) pipelineWhere.source = source;

    const [intakeRows, pipelineLeads] = await Promise.all([
      db.intakeLead.findMany({
        where,
        orderBy: [{ nextActionDueAt: "asc" }, { followUpDueAt: "asc" }],
        take: 500,
      }),
      db.lead.findMany({
        where: pipelineWhere,
        orderBy: { nextActionDueAt: "asc" },
        take: 500,
        select: {
          id: true,
          title: true,
          source: true,
          status: true,
          score: true,
          nextAction: true,
          nextActionDueAt: true,
          contactName: true,
          contactEmail: true,
          lastContactAt: true,
          followUpCount: true,
        },
      }),
    ]);

    const intakeItems = intakeRows.map(toIntakeItem);
    const pipelineItems = pipelineLeads.map(toPipelineItem);

    function getItemEffectiveDue(item: FollowUpItem): Date | null {
      const a = item.nextActionDueAt ? new Date(item.nextActionDueAt) : null;
      const b = item.followUpDueAt ? new Date(item.followUpDueAt) : null;
      if (a && isValidDate(a)) return a;
      if (b && isValidDate(b)) return b;
      return null;
    }

    const allItems: FollowUpItem[] = [...intakeItems, ...pipelineItems].sort((a, b) => {
      const da = getItemEffectiveDue(a)?.getTime() ?? Infinity;
      const db_ = getItemEffectiveDue(b)?.getTime() ?? Infinity;
      return da - db_;
    });

    const overdue: FollowUpItem[] = [];
    const today: FollowUpItem[] = [];
    const upcoming: FollowUpItem[] = [];

    for (const item of allItems) {
      const effectiveDue = getItemEffectiveDue(item);
      if (!effectiveDue) continue;
      const b = classifyFollowUpBucket(effectiveDue, now, days);
      if (b === "overdue") overdue.push(item);
      else if (b === "today") today.push(item);
      else if (b === "upcoming") upcoming.push(item);
    }

    const totals = {
      overdue: overdue.length,
      today: today.length,
      upcoming: upcoming.length,
      all: allItems.length,
    };

    if (bucket && bucket !== "all") {
      const filtered =
        bucket === "overdue"
          ? overdue
          : bucket === "today"
            ? today
            : bucket === "upcoming"
              ? upcoming
              : allItems;
      const pageItems = filtered.slice(pagination.skip, pagination.skip + pagination.pageSize);
      const meta = buildPaginationMeta(filtered.length, pagination);
      return NextResponse.json({
        items: pageItems,
        pagination: meta,
        totals,
      });
    }

    const pageItems = allItems.slice(pagination.skip, pagination.skip + pagination.pageSize);
    const meta = buildPaginationMeta(allItems.length, pagination);
    return NextResponse.json({
      items: pageItems,
      pagination: meta,
      overdue,
      today,
      upcoming,
      totals,
    });
  });
}
