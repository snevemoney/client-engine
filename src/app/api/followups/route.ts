import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { IntakeLeadStatus } from "@prisma/client";
import { withRouteTiming } from "@/lib/api-utils";
import {
  getStartOfDay,
  getEndOfDay,
  classifyFollowUpBucket,
  isValidDate,
  type Bucket,
} from "@/lib/followup/dates";

type FollowUpItem = {
  id: string;
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

function toItem(row: {
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

function getEffectiveDue(row: {
  nextActionDueAt: Date | null;
  followUpDueAt: Date | null;
}): Date | null {
  const a = row.nextActionDueAt;
  const b = row.followUpDueAt;
  if (a && isValidDate(a)) return a;
  if (b && isValidDate(b)) return b;
  return null;
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

    const now = new Date();
    const startToday = getStartOfDay(now);
    const endToday = getEndOfDay(now);
    const endUpcoming = new Date(now);
    endUpcoming.setDate(endUpcoming.getDate() + days);
    endUpcoming.setHours(23, 59, 59, 999);

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

    const rows = await db.intakeLead.findMany({
      where,
      orderBy: [{ nextActionDueAt: "asc" }, { followUpDueAt: "asc" }],
      take: 200,
    });

    const items = rows.map(toItem);
    const overdue: FollowUpItem[] = [];
    const today: FollowUpItem[] = [];
    const upcoming: FollowUpItem[] = [];

    for (const row of rows) {
      const effectiveDue = getEffectiveDue(row);
      if (!effectiveDue) continue;
      const item = toItem(row);
      const b = classifyFollowUpBucket(effectiveDue, now, days);
      if (b === "overdue") overdue.push(item);
      else if (b === "today") today.push(item);
      else if (b === "upcoming") upcoming.push(item);
    }

    if (bucket && bucket !== "all") {
      const filtered =
        bucket === "overdue"
          ? overdue
          : bucket === "today"
            ? today
            : bucket === "upcoming"
              ? upcoming
              : items;
      return NextResponse.json({
        [bucket]: filtered,
        totals: {
          overdue: overdue.length,
          today: today.length,
          upcoming: upcoming.length,
          all: items.length,
        },
      });
    }

    return NextResponse.json({
      overdue,
      today,
      upcoming,
      totals: {
        overdue: overdue.length,
        today: today.length,
        upcoming: upcoming.length,
        all: items.length,
      },
    });
  });
}
