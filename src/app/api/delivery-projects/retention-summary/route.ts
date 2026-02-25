/**
 * GET /api/delivery-projects/retention-summary — Retention queue summary.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { classifyRetentionBucket, computeRetentionStale } from "@/lib/delivery/retention";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/delivery-projects/retention-summary", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const projects = await db.deliveryProject.findMany({
      where: { status: { in: ["completed", "archived"] } },
      select: {
        id: true,
        status: true,
        handoffCompletedAt: true,
        testimonialRequestedAt: true,
        testimonialReceivedAt: true,
        testimonialStatus: true,
        reviewRequestedAt: true,
        reviewReceivedAt: true,
        referralRequestedAt: true,
        referralReceivedAt: true,
        referralStatus: true,
        retentionStatus: true,
        retentionNextFollowUpAt: true,
        retentionLastContactedAt: true,
      },
    });

    const now = new Date();
    let dueToday = 0;
    let overdue = 0;
    let upcoming = 0;
    let testimonialRequested = 0;
    let testimonialReceived = 0;
    let reviewRequested = 0;
    let reviewReceived = 0;
    let referralRequested = 0;
    let referralReceived = 0;
    let retainerOpen = 0;
    let upsellOpen = 0;
    let closedWon = 0;
    let closedLost = 0;
    let stalePostDelivery = 0;

    for (const p of projects) {
      const bucket = classifyRetentionBucket(p.retentionNextFollowUpAt, now);
      if (bucket === "overdue") overdue++;
      else if (bucket === "today") dueToday++;
      else if (bucket === "upcoming") upcoming++;

      if (p.testimonialRequestedAt) testimonialRequested++;
      if (p.testimonialReceivedAt) testimonialReceived++;
      if (p.reviewRequestedAt) reviewRequested++;
      if (p.reviewReceivedAt) reviewReceived++;
      if (p.referralRequestedAt) referralRequested++;
      if (p.referralReceivedAt) referralReceived++;

      const status = (p.retentionStatus ?? "none").toString();
      if (status === "retainer_open") retainerOpen++;
      else if (status === "upsell_open") upsellOpen++;
      else if (status === "closed_won") closedWon++;
      else if (status === "closed_lost") closedLost++;

      const { isStale } = computeRetentionStale(p);
      if (isStale) stalePostDelivery++;
    }

    return NextResponse.json({
      dueToday: dueToday ?? 0,
      overdue: overdue ?? 0,
      upcoming: upcoming ?? 0,
      testimonialRequested: testimonialRequested ?? 0,
      testimonialReceived: testimonialReceived ?? 0,
      reviewRequested: reviewRequested ?? 0,
      reviewReceived: reviewReceived ?? 0,
      referralRequested: referralRequested ?? 0,
      referralReceived: referralReceived ?? 0,
      retainerOpen: retainerOpen ?? 0,
      upsellOpen: upsellOpen ?? 0,
      closedWon: closedWon ?? 0,
      closedLost: closedLost ?? 0,
      stalePostDelivery: stalePostDelivery ?? 0,
    });
  });
}
