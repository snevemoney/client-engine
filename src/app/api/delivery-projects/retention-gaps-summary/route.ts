/**
 * GET /api/delivery-projects/retention-gaps-summary — Post-delivery gaps.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/delivery-projects/retention-gaps-summary", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const projects = await db.deliveryProject.findMany({
      where: { status: { in: ["completed", "archived"] } },
      select: {
        id: true,
        handoffCompletedAt: true,
        clientConfirmedAt: true,
        testimonialRequestedAt: true,
        testimonialReceivedAt: true,
        testimonialStatus: true,
        proofCandidateId: true,
        reviewRequestedAt: true,
        referralRequestedAt: true,
        retentionNextFollowUpAt: true,
        retentionLastContactedAt: true,
      },
    });

    let completedNoTestimonialRequest = 0;
    let completedNoReviewRequest = 0;
    let completedNoReferralRequest = 0;
    let completedNoRetentionFollowup = 0;
    let testimonialReceivedNoProofLink = 0;
    let handoffDoneNoClientConfirm = 0;

    for (const p of projects) {
      const hasHandoffDone = !!p.handoffCompletedAt;
      const hasClientConfirm = !!p.clientConfirmedAt;

      if (hasHandoffDone && !hasClientConfirm) handoffDoneNoClientConfirm++;

      if (!p.testimonialRequestedAt) completedNoTestimonialRequest++;
      if (!p.reviewRequestedAt) completedNoReviewRequest++;
      if (!p.referralRequestedAt) completedNoReferralRequest++;

      const hasRetentionActivity =
        p.retentionNextFollowUpAt || p.retentionLastContactedAt;
      if (!hasRetentionActivity) completedNoRetentionFollowup++;

      if (
        p.testimonialReceivedAt &&
        p.testimonialStatus === "received" &&
        !p.proofCandidateId
      ) {
        testimonialReceivedNoProofLink++;
      }
    }

    return NextResponse.json({
      completedNoTestimonialRequest: completedNoTestimonialRequest ?? 0,
      completedNoReviewRequest: completedNoReviewRequest ?? 0,
      completedNoReferralRequest: completedNoReferralRequest ?? 0,
      completedNoRetentionFollowup: completedNoRetentionFollowup ?? 0,
      testimonialReceivedNoProofLink: testimonialReceivedNoProofLink ?? 0,
      handoffDoneNoClientConfirm: handoffDoneNoClientConfirm ?? 0,
    });
  });
}
