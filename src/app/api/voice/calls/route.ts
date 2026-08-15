/**
 * GET /api/voice/calls — List voice call logs.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, jsonError, withRouteTiming } from "@/lib/api-utils";
import { parsePaginationParams, buildPaginationMeta, paginatedResponse } from "@/lib/pagination";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withRouteTiming("GET /api/voice/calls", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const url = new URL(req.url);
    const pagination = parsePaginationParams(url.searchParams);

    const [logs, total] = await Promise.all([
      db.voiceCallLog.findMany({
        orderBy: { calledAt: "desc" },
        skip: pagination.skip,
        take: pagination.pageSize,
        select: {
          id: true,
          proposalId: true,
          contactPhone: true,
          outcome: true,
          calledAt: true,
          durationSeconds: true,
          externalCallId: true,
          proposal: { select: { title: true, company: true, clientName: true } },
        },
      }),
      db.voiceCallLog.count(),
    ]);

    const meta = buildPaginationMeta(total, pagination);
    const items = logs.map((l) => ({
      id: l.id,
      proposalId: l.proposalId,
      contactPhone: l.contactPhone,
      outcome: l.outcome,
      calledAt: l.calledAt.toISOString(),
      durationSeconds: l.durationSeconds,
      externalCallId: l.externalCallId,
      proposal: l.proposal
        ? { title: l.proposal.title, company: l.proposal.company, clientName: l.proposal.clientName }
        : null,
    }));

    return NextResponse.json(paginatedResponse(items, meta));
  });
}
