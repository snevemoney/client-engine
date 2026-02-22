/**
 * Referrals from a lead: list and create.
 * POST creates a referral linked to this lead (source); updates source lead's referralCount.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const referralPayloadSchema = z.object({
  referredName: z.string().min(1).max(500),
  referredCompany: z.string().optional(),
  referredContact: z.string().optional(),
  referralQuality: z.number().int().min(1).max(5).optional(),
  notes: z.string().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: sourceLeadId } = await params;
  const lead = await db.lead.findUnique({ where: { id: sourceLeadId } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const referrals = await db.leadReferral.findMany({
    where: { sourceLeadId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(referrals);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: sourceLeadId } = await params;
  const lead = await db.lead.findUnique({ where: { id: sourceLeadId } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = referralPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const [referral] = await db.$transaction([
    db.leadReferral.create({
      data: {
        sourceLeadId,
        referredName: parsed.data.referredName,
        referredCompany: parsed.data.referredCompany ?? null,
        referredContact: parsed.data.referredContact ?? null,
        referralQuality: parsed.data.referralQuality ?? null,
        notes: parsed.data.notes ?? null,
      },
    }),
    db.lead.update({
      where: { id: sourceLeadId },
      data: { referralCount: { increment: 1 } },
    }),
  ]);

  return NextResponse.json(referral);
}
