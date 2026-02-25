/**
 * GET /api/delivery-projects/retention-weekly — Retention weekly stats.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { getWeekStart } from "@/lib/ops/weekStart";
import { classifyRetentionBucket, computeRetentionStale } from "@/lib/delivery/retention";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/delivery-projects/retention-weekly", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const now = new Date();
    const weekStart = getWeekStart(now);
    const endOfWeek = new Date(weekStart);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const projects = await db.deliveryProject.findMany({
      where: { status: { in: ["completed", "archived"] } },
      select: {
        id: true,
        testimonialRequestedAt: true,
        testimonialReceivedAt: true,
        reviewRequestedAt: true,
        reviewReceivedAt: true,
        referralRequestedAt: true,
        referralReceivedAt: true,
        retentionStatus: true,
        retentionNextFollowUpAt: true,
        retentionLastContactedAt: true,
        handoffCompletedAt: true,
      },
    });

    const projectIds = projects.map((p) => p.id);
    const activities =
      projectIds.length > 0
        ? await db.deliveryActivity.findMany({
            where: {
              deliveryProjectId: { in: projectIds },
              createdAt: { gte: weekStart, lte: endOfWeek },
              type: {
                in: [
                  "retention_followup_completed",
                  "retention_followup_email",
                  "retention_followup_call",
                  "testimonial_requested",
                  "testimonial_received",
                  "review_requested",
                  "review_received",
                  "referral_requested",
                  "referral_received",
                  "upsell_logged",
                ],
              },
            },
            select: { type: true, deliveryProjectId: true },
          })
        : [];
    const validProjectIds = new Set(projectIds);
    const activitiesByProject = activities.filter((a) => validProjectIds.has(a.deliveryProjectId));

    let retentionFollowupsCompletedThisWeek = 0;
    let testimonialRequestsThisWeek = 0;
    let testimonialsReceivedThisWeek = 0;
    let reviewRequestsThisWeek = 0;
    let reviewsReceivedThisWeek = 0;
    let referralRequestsThisWeek = 0;
    let referralsReceivedThisWeek = 0;
    let upsellOpenedThisWeek = 0;

    const seenProjects = new Set<string>();
    for (const a of activitiesByProject) {
      const key = `${a.deliveryProjectId}-${a.type}`;
      if (seenProjects.has(key)) continue;
      seenProjects.add(key);
      switch (a.type) {
        case "retention_followup_completed":
        case "retention_followup_email":
        case "retention_followup_call":
          retentionFollowupsCompletedThisWeek++;
          break;
        case "testimonial_requested":
          testimonialRequestsThisWeek++;
          break;
        case "testimonial_received":
          testimonialsReceivedThisWeek++;
          break;
        case "review_requested":
          reviewRequestsThisWeek++;
          break;
        case "review_received":
          reviewsReceivedThisWeek++;
          break;
        case "referral_requested":
          referralRequestsThisWeek++;
          break;
        case "referral_received":
          referralsReceivedThisWeek++;
          break;
        case "upsell_logged":
          upsellOpenedThisWeek++;
          break;
      }
    }

    let retentionOverdue = 0;
    let stalePostDelivery = 0;
    for (const p of projects) {
      const bucket = classifyRetentionBucket(p.retentionNextFollowUpAt, now);
      if (bucket === "overdue") retentionOverdue++;
      const { isStale } = computeRetentionStale(p);
      if (isStale) stalePostDelivery++;
    }

    return NextResponse.json({
      retentionFollowupsCompletedThisWeek: retentionFollowupsCompletedThisWeek ?? 0,
      testimonialRequestsThisWeek: testimonialRequestsThisWeek ?? 0,
      testimonialsReceivedThisWeek: testimonialsReceivedThisWeek ?? 0,
      reviewRequestsThisWeek: reviewRequestsThisWeek ?? 0,
      reviewsReceivedThisWeek: reviewsReceivedThisWeek ?? 0,
      referralRequestsThisWeek: referralRequestsThisWeek ?? 0,
      referralsReceivedThisWeek: referralsReceivedThisWeek ?? 0,
      upsellOpenedThisWeek: upsellOpenedThisWeek ?? 0,
      retentionOverdue: retentionOverdue ?? 0,
      stalePostDelivery: stalePostDelivery ?? 0,
    });
  });
}
