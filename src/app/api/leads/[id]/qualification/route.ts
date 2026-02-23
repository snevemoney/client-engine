/**
 * PATCH /api/leads/[id]/qualification — Update qualification score fields (0-2 each)
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const scoreSchema = z.number().int().min(0).max(2).nullable();

const qualificationSchema = z.object({
  scorePain: scoreSchema.optional(),
  scoreUrgency: scoreSchema.optional(),
  scoreBudget: scoreSchema.optional(),
  scoreResponsiveness: scoreSchema.optional(),
  scoreDecisionMaker: scoreSchema.optional(),
  scoreFit: scoreSchema.optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withRouteTiming("PATCH /api/leads/[id]/qualification", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const lead = await db.lead.findUnique({ where: { id } });
    if (!lead) return jsonError("Lead not found", 404);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError("Invalid JSON", 400);
    }

    const parsed = qualificationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await db.lead.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json(updated);
  });
}
