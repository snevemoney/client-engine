/**
 * PATCH /api/ops/strategy-week/review — Upsert review for current week (or weekStart query)
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWeekStart } from "@/lib/ops/strategyWeek";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const reviewSchema = z.object({
  campaignShipped: z.boolean().optional(),
  systemImproved: z.boolean().optional(),
  salesActionsDone: z.boolean().optional(),
  proofCaptured: z.boolean().optional(),
  biggestBottleneck: z.string().optional(),
  nextAutomation: z.string().optional(),
  score: z.number().min(0).max(100).optional(),
  whatWorked: z.string().optional(),
  whatFailed: z.string().optional(),
  whatChanged: z.string().optional(),
  proofCapturedNotes: z.string().optional(),
  nextWeekCommitments: z.string().optional(),
  complete: z.boolean().optional(), // set completedAt when true
});

export async function PATCH(req: NextRequest) {
  return withRouteTiming("PATCH /api/ops/strategy-week/review", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError("Invalid JSON", 400);
    }

    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const weekStartParam = searchParams.get("weekStart");
    const weekStart = weekStartParam ? getWeekStart(new Date(weekStartParam)) : getWeekStart();
    const data = parsed.data;

    const week = await db.strategyWeek.upsert({
      where: { weekStart },
      create: { weekStart },
      update: {},
    });

    const now = new Date();
    const createData = {
      strategyWeekId: week.id,
      campaignShipped: data.campaignShipped ?? false,
      systemImproved: data.systemImproved ?? false,
      salesActionsDone: data.salesActionsDone ?? false,
      proofCaptured: data.proofCaptured ?? false,
      biggestBottleneck: data.biggestBottleneck ?? null,
      nextAutomation: data.nextAutomation ?? null,
      score: data.score ?? null,
      whatWorked: data.whatWorked ?? null,
      whatFailed: data.whatFailed ?? null,
      whatChanged: data.whatChanged ?? null,
      proofCapturedNotes: data.proofCapturedNotes ?? null,
      nextWeekCommitments: data.nextWeekCommitments ?? null,
      completedAt: data.complete ? now : null,
    };
    const updateData: Record<string, unknown> = {
      ...(typeof data.campaignShipped === "boolean" && { campaignShipped: data.campaignShipped }),
      ...(typeof data.systemImproved === "boolean" && { systemImproved: data.systemImproved }),
      ...(typeof data.salesActionsDone === "boolean" && { salesActionsDone: data.salesActionsDone }),
      ...(typeof data.proofCaptured === "boolean" && { proofCaptured: data.proofCaptured }),
      ...(data.biggestBottleneck !== undefined && { biggestBottleneck: data.biggestBottleneck || null }),
      ...(data.nextAutomation !== undefined && { nextAutomation: data.nextAutomation || null }),
      ...(data.score !== undefined && { score: data.score ?? null }),
      ...(data.whatWorked !== undefined && { whatWorked: data.whatWorked || null }),
      ...(data.whatFailed !== undefined && { whatFailed: data.whatFailed || null }),
      ...(data.whatChanged !== undefined && { whatChanged: data.whatChanged || null }),
      ...(data.proofCapturedNotes !== undefined && { proofCapturedNotes: data.proofCapturedNotes || null }),
      ...(data.nextWeekCommitments !== undefined && { nextWeekCommitments: data.nextWeekCommitments || null }),
      ...(data.complete === true && { completedAt: now }),
    };
    const review = await db.strategyWeekReview.upsert({
      where: { strategyWeekId: week.id },
      create: createData,
      update: updateData,
    });
    if (data.complete) {
      await db.strategyWeek.update({
        where: { id: week.id },
        data: { lastReviewedAt: now },
      });
    }
    return NextResponse.json(review);
  });
}
