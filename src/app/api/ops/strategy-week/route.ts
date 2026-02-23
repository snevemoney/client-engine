/**
 * GET /api/ops/strategy-week — Current week record (or null if none)
 * POST /api/ops/strategy-week — Create or upsert current week
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWeekStart } from "@/lib/ops/strategyWeek";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  phase: z.enum(["survival", "formulation", "explosion", "plateau"]).optional(),
  activeCampaignName: z.string().optional(),
  activeCampaignAudience: z.string().optional(),
  activeCampaignChannel: z.string().optional(),
  activeCampaignOffer: z.string().optional(),
  activeCampaignCta: z.string().optional(),
  activeCampaignProof: z.string().optional(),
  operatorImprovementFocus: z.string().optional(),
  salesTarget: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  return withRouteTiming("GET /api/ops/strategy-week", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const weekStart = getWeekStart();
    const record = await db.strategyWeek.findUnique({
      where: { weekStart },
      include: { review: true },
    });
    return NextResponse.json(record);
  });
}

export async function POST(req: NextRequest) {
  return withRouteTiming("POST /api/ops/strategy-week", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError("Invalid JSON", 400);
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const weekStart = getWeekStart();
    const data = parsed.data;
    const update = {
      phase: data.phase ?? undefined,
      activeCampaignName: data.activeCampaignName ?? undefined,
      activeCampaignAudience: data.activeCampaignAudience ?? undefined,
      activeCampaignChannel: data.activeCampaignChannel ?? undefined,
      activeCampaignOffer: data.activeCampaignOffer ?? undefined,
      activeCampaignCta: data.activeCampaignCta ?? undefined,
      activeCampaignProof: data.activeCampaignProof ?? undefined,
      operatorImprovementFocus: data.operatorImprovementFocus ?? undefined,
      salesTarget: data.salesTarget ?? undefined,
      notes: data.notes ?? undefined,
    };

    const record = await db.strategyWeek.upsert({
      where: { weekStart },
      create: { weekStart, ...update },
      update,
      include: { review: true },
    });
    return NextResponse.json(record);
  });
}
