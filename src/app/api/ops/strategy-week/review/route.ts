/**
 * PATCH /api/ops/strategy-week/review — Upsert review for current week
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

    const weekStart = getWeekStart();
    const data = parsed.data;

    const week = await db.strategyWeek.upsert({
      where: { weekStart },
      create: { weekStart },
      update: {},
    });

    const review = await db.strategyWeekReview.upsert({
      where: { strategyWeekId: week.id },
      create: {
        strategyWeekId: week.id,
        campaignShipped: data.campaignShipped ?? false,
        systemImproved: data.systemImproved ?? false,
        salesActionsDone: data.salesActionsDone ?? false,
        proofCaptured: data.proofCaptured ?? false,
        biggestBottleneck: data.biggestBottleneck ?? null,
        nextAutomation: data.nextAutomation ?? null,
      },
      update: {
        ...(typeof data.campaignShipped === "boolean" && { campaignShipped: data.campaignShipped }),
        ...(typeof data.systemImproved === "boolean" && { systemImproved: data.systemImproved }),
        ...(typeof data.salesActionsDone === "boolean" && { salesActionsDone: data.salesActionsDone }),
        ...(typeof data.proofCaptured === "boolean" && { proofCaptured: data.proofCaptured }),
        ...(data.biggestBottleneck !== undefined && { biggestBottleneck: data.biggestBottleneck || null }),
        ...(data.nextAutomation !== undefined && { nextAutomation: data.nextAutomation || null }),
      },
    });
    return NextResponse.json(review);
  });
}
