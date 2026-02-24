/**
 * GET /api/proposals/summary — Scoreboard counts.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { getWeekStart } from "@/lib/ops/weekStart";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/proposals/summary", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const now = new Date();
    const weekStart = getWeekStart(now);
    const endOfWeek = new Date(weekStart);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const [drafts, ready, sentThisWeek, acceptedThisWeek, rejectedThisWeek, proposalsWithPrice] =
      await Promise.all([
        db.proposal.count({ where: { status: "draft" } }),
        db.proposal.count({ where: { status: "ready" } }),
        db.proposal.count({
          where: {
            status: "sent",
            sentAt: { gte: weekStart, lte: endOfWeek },
          },
        }),
        db.proposal.count({
          where: {
            status: "accepted",
            acceptedAt: { gte: weekStart, lte: endOfWeek },
          },
        }),
        db.proposal.count({
          where: {
            status: "rejected",
            rejectedAt: { gte: weekStart, lte: endOfWeek },
          },
        }),
        db.proposal.findMany({
          where: {
            status: { in: ["accepted", "sent"] },
            OR: [{ priceMin: { not: null } }, { priceMax: { not: null } }],
          },
          select: { priceMin: true, priceMax: true },
        }),
      ]);

    const values = proposalsWithPrice.map((p) => {
      const min = p.priceMin ?? 0;
      const max = p.priceMax ?? 0;
      if (min > 0 && max > 0) return (min + max) / 2;
      return min || max;
    }).filter((v) => v > 0);
    const avgProposalValue =
      values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;

    return NextResponse.json({
      drafts,
      ready,
      sentThisWeek,
      acceptedThisWeek,
      rejectedThisWeek,
      avgProposalValue,
    });
  });
}
