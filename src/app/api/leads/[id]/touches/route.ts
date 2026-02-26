/**
 * Lead touches: log a touch and list touch history.
 * POST creates a touch and updates lead's touchCount, lastContactAt, nextContactAt, lastTouchType.
 */

import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const touchPayloadSchema = z.object({
  type: z.enum(["EMAIL", "CALL", "LINKEDIN_DM", "MEETING", "FOLLOW_UP", "REFERRAL_ASK", "CHECK_IN", "CALL_BOOKED", "CALL_COMPLETED"]),
  direction: z.enum(["outbound", "inbound"]),
  summary: z.string().min(1).max(4000),
  scriptUsed: z.string().optional(),
  outcome: z.string().optional(),
  nextAction: z.string().optional(),
  nextTouchAt: z.string().optional().nullable(),
  followUpStage: z.number().int().min(0).optional(),
  detailsCaptured: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: leadId } = await params;
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const touches = await db.leadTouch.findMany({
    where: { leadId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(touches);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: leadId } = await params;
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = touchPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { type, direction, summary, scriptUsed, outcome, nextAction, nextTouchAt, followUpStage, detailsCaptured } =
    parsed.data;

  const [touch] = await db.$transaction([
    db.leadTouch.create({
      data: {
        leadId,
        type,
        direction,
        summary,
        scriptUsed: scriptUsed ?? null,
        outcome: outcome ?? null,
        nextAction: nextAction ?? null,
        nextTouchAt: nextTouchAt ? new Date(nextTouchAt) : null,
        detailsCaptured: detailsCaptured ? (detailsCaptured as Prisma.InputJsonValue) : undefined,
      },
    }),
    db.lead.update({
      where: { id: leadId },
      data: {
        touchCount: { increment: 1 },
        lastContactAt: new Date(),
        lastTouchType: type,
        ...(nextTouchAt ? { nextContactAt: new Date(nextTouchAt) } : {}),
        ...(typeof followUpStage === "number" ? { followUpStage } : {}),
      },
    }),
  ]);
  return NextResponse.json(touch!);
}
