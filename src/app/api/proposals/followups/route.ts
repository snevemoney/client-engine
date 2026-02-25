/**
 * GET /api/proposals/followups — Proposal follow-up queue (overdue, today, upcoming, stale).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { parsePaginationParams, buildPaginationMeta, paginatedResponse } from "@/lib/pagination";
import { getStartOfDay, getEndOfDay } from "@/lib/followup/dates";
import { classifyProposalFollowupBucket, computeProposalStaleState } from "@/lib/proposals/followup";

export const dynamic = "force-dynamic";

type ProposalFollowupItem = {
  id: string;
  title: string;
  company: string | null;
  clientName: string | null;
  status: string;
  responseStatus: string;
  sentAt: string | null;
  nextFollowUpAt: string | null;
  lastContactedAt: string | null;
  followUpCount: number;
  intakeLeadId: string | null;
};

function toItem(p: {
  id: string;
  title: string;
  company: string | null;
  clientName: string | null;
  status: string;
  responseStatus: string;
  sentAt: Date | null;
  nextFollowUpAt: Date | null;
  lastContactedAt: Date | null;
  followUpCount: number;
  respondedAt: Date | null;
  acceptedAt: Date | null;
  rejectedAt: Date | null;
  staleAfterDays: number | null;
  intakeLeadId: string | null;
}): ProposalFollowupItem {
  return {
    id: p.id,
    title: p.title ?? "",
    company: p.company ?? null,
    clientName: p.clientName ?? null,
    status: p.status ?? "draft",
    responseStatus: p.responseStatus ?? "none",
    sentAt: p.sentAt?.toISOString() ?? null,
    nextFollowUpAt: p.nextFollowUpAt?.toISOString() ?? null,
    lastContactedAt: p.lastContactedAt?.toISOString() ?? null,
    followUpCount: p.followUpCount ?? 0,
    intakeLeadId: p.intakeLeadId ?? null,
  };
}

export async function GET(req: NextRequest) {
  return withRouteTiming("GET /api/proposals/followups", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const url = new URL(req.url);
    const bucket = url.searchParams.get("bucket");
    const search = url.searchParams.get("search")?.trim();
    const responseStatus = url.searchParams.get("responseStatus")?.trim();
    const pagination = parsePaginationParams(url.searchParams);

    const now = new Date();
    const startToday = getStartOfDay(now);
    const endToday = getEndOfDay(now);

    const proposals = await db.proposal.findMany({
      where: {
        status: { in: ["sent", "viewed"] },
        acceptedAt: null,
        rejectedAt: null,
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: "insensitive" as const } },
                { company: { contains: search, mode: "insensitive" as const } },
                { clientName: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
        ...(responseStatus && responseStatus !== "all"
          ? { responseStatus: responseStatus as "none" | "viewed" | "replied" | "meeting_booked" | "negotiating" }
          : {}),
      },
      select: {
        id: true,
        title: true,
        company: true,
        clientName: true,
        status: true,
        responseStatus: true,
        sentAt: true,
        nextFollowUpAt: true,
        lastContactedAt: true,
        followUpCount: true,
        respondedAt: true,
        acceptedAt: true,
        rejectedAt: true,
        staleAfterDays: true,
        intakeLeadId: true,
      },
      orderBy: [{ nextFollowUpAt: "asc" }, { sentAt: "asc" }],
    });

    const overdue: ProposalFollowupItem[] = [];
    const today: ProposalFollowupItem[] = [];
    const upcoming: ProposalFollowupItem[] = [];
    const stale: ProposalFollowupItem[] = [];
    const noFollowup: ProposalFollowupItem[] = [];

    const seenIds = new Set<string>();
    for (const p of proposals) {
      const item = toItem(p);
      const b = classifyProposalFollowupBucket(p.nextFollowUpAt, now, 7);
      const { isStale } = computeProposalStaleState(p);

      if (!p.nextFollowUpAt) {
        noFollowup.push(item);
        seenIds.add(p.id);
      } else if (b === "overdue") { overdue.push(item); seenIds.add(p.id); }
      else if (b === "today") { today.push(item); seenIds.add(p.id); }
      else if (b === "upcoming") { upcoming.push(item); seenIds.add(p.id); }

      if (isStale && !seenIds.has(p.id)) stale.push(item);
    }

    const filterBucket = bucket && ["overdue", "today", "upcoming", "stale", "no_followup"].includes(bucket) ? bucket : "all";

    const combined =
      filterBucket === "overdue"
        ? overdue
        : filterBucket === "today"
          ? today
          : filterBucket === "upcoming"
            ? upcoming
            : filterBucket === "stale"
              ? stale
              : filterBucket === "no_followup"
                ? noFollowup
                : (() => {
                    const seen = new Set<string>();
                    const out: ProposalFollowupItem[] = [];
                    for (const arr of [overdue, today, upcoming, stale, noFollowup]) {
                      for (const item of arr) {
                        if (!seen.has(item.id)) {
                          seen.add(item.id);
                          out.push(item);
                        }
                      }
                    }
                    return out;
                  })();

    const total = combined.length;
    const pageItems = combined.slice(pagination.skip, pagination.skip + pagination.pageSize);
    const meta = buildPaginationMeta(total, pagination);

    return NextResponse.json({
      ...paginatedResponse(pageItems, meta),
      overdue: filterBucket === "all" || filterBucket === "overdue" ? overdue : [],
      today: filterBucket === "all" || filterBucket === "today" ? today : [],
      upcoming: filterBucket === "all" || filterBucket === "upcoming" ? upcoming : [],
      stale: filterBucket === "all" || filterBucket === "stale" ? stale : [],
      noFollowup: filterBucket === "all" || filterBucket === "no_followup" ? noFollowup : [],
      totals: {
        overdue: overdue.length,
        today: today.length,
        upcoming: upcoming.length,
        stale: stale.length,
        noFollowup: noFollowup.length,
      },
    });
  });
}
