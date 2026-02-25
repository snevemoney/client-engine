/**
 * GET /api/delivery-projects/retention-queue — Projects for retention follow-up.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { parsePaginationParams, buildPaginationMeta, paginatedResponse } from "@/lib/pagination";
import { classifyRetentionBucket, computeRetentionStale } from "@/lib/delivery/retention";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withRouteTiming("GET /api/delivery-projects/retention-queue", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const url = new URL(req.url);
    const statusFilter = url.searchParams.get("status"); // retentionStatus
    const bucketFilter = url.searchParams.get("bucket"); // overdue | today | upcoming | none
    const testimonialFilter = url.searchParams.get("testimonial");
    const referralFilter = url.searchParams.get("referral");
    const search = url.searchParams.get("search") ?? url.searchParams.get("q");
    const pagination = parsePaginationParams(url.searchParams);

    const projects = await db.deliveryProject.findMany({
      where: {
        status: { in: ["completed", "archived"] },
        ...(search?.trim()
          ? {
              OR: [
                { title: { contains: search.trim(), mode: "insensitive" as const } },
                { clientName: { contains: search.trim(), mode: "insensitive" as const } },
                { company: { contains: search.trim(), mode: "insensitive" as const } },
              ],
            }
          : {}),
        ...(statusFilter && statusFilter !== "all"
          ? { retentionStatus: statusFilter as "none" | "monitoring" | "followup_due" | "upsell_open" | "retainer_open" | "closed_won" | "closed_lost" }
          : {}),
      },
      select: {
        id: true,
        title: true,
        clientName: true,
        company: true,
        status: true,
        completedAt: true,
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
        retentionFollowUpCount: true,
        upsellOpportunity: true,
        upsellValueEstimate: true,
      },
      orderBy: [{ retentionNextFollowUpAt: "asc" }, { updatedAt: "desc" }],
      take: 500,
    });

    const now = new Date();
    type Row = (typeof projects)[0] & { retentionBucket: string; isStale: boolean };
    const rows: Row[] = projects.map((p) => {
      const bucket = classifyRetentionBucket(p.retentionNextFollowUpAt, now);
      const { isStale } = computeRetentionStale(p);
      return { ...p, retentionBucket: bucket, isStale };
    });

    let filtered = rows;
    if (bucketFilter && bucketFilter !== "all") {
      filtered = filtered.filter((r) => r.retentionBucket === bucketFilter);
    }
    if (testimonialFilter && testimonialFilter !== "all") {
      if (testimonialFilter === "requested") filtered = filtered.filter((r) => r.testimonialRequestedAt);
      else if (testimonialFilter === "received") filtered = filtered.filter((r) => r.testimonialReceivedAt);
    }
    if (referralFilter && referralFilter !== "all") {
      if (referralFilter === "requested") filtered = filtered.filter((r) => r.referralRequestedAt);
      else if (referralFilter === "received") filtered = filtered.filter((r) => r.referralReceivedAt);
    }

    const total = filtered.length;
    const pageItems = filtered.slice(pagination.skip, pagination.skip + pagination.pageSize);
    const meta = buildPaginationMeta(total, pagination);

    return NextResponse.json(
      paginatedResponse(
        pageItems.map((p) => ({
        id: p.id,
        title: p.title ?? "",
        clientName: p.clientName ?? null,
        company: p.company ?? null,
        status: p.status ?? "completed",
        completedAt: p.completedAt?.toISOString() ?? null,
        handoffCompletedAt: p.handoffCompletedAt?.toISOString() ?? null,
        testimonialRequestedAt: p.testimonialRequestedAt?.toISOString() ?? null,
        testimonialReceivedAt: p.testimonialReceivedAt?.toISOString() ?? null,
        testimonialStatus: p.testimonialStatus ?? "none",
        reviewRequestedAt: p.reviewRequestedAt?.toISOString() ?? null,
        reviewReceivedAt: p.reviewReceivedAt?.toISOString() ?? null,
        referralRequestedAt: p.referralRequestedAt?.toISOString() ?? null,
        referralReceivedAt: p.referralReceivedAt?.toISOString() ?? null,
        referralStatus: p.referralStatus ?? "none",
        retentionStatus: p.retentionStatus ?? "none",
        retentionBucket: p.retentionBucket,
        retentionNextFollowUpAt: p.retentionNextFollowUpAt?.toISOString() ?? null,
        retentionLastContactedAt: p.retentionLastContactedAt?.toISOString() ?? null,
        retentionFollowUpCount: p.retentionFollowUpCount ?? 0,
        upsellOpportunity: p.upsellOpportunity ?? null,
        upsellValueEstimate: p.upsellValueEstimate ?? null,
        isStale: p.isStale,
      })),
        meta
      )
    );
  });
}
