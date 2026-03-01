/**
 * GET /api/internal/sidebar-counts — Lightweight counts for sidebar badges.
 * Returns NBA queue, open risk flags, and overdue proposals.
 */
import { NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { swrCacheHeaders } from "@/lib/http/response";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/internal/sidebar-counts", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const [nba, risk, proposalsOverdue] = await Promise.all([
      db.nextBestAction.count({
        where: { status: "queued", priority: { in: ["critical", "high"] } },
      }),
      db.riskFlag.count({
        where: { status: "open", severity: { in: ["critical", "high"] } },
      }),
      db.proposal.count({
        where: {
          status: "sent",
          sentAt: { lt: threeDaysAgo, not: null },
          acceptedAt: null,
          rejectedAt: null,
        },
      }),
    ]);

    return NextResponse.json(
      { nba, risk, proposalsOverdue },
      { headers: swrCacheHeaders(60) },
    );
  });
}
