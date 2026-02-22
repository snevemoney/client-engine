/**
 * PATCH a referral: update status, quality, notes, convertedLeadId.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const patchSchema = z.object({
  status: z.enum(["new", "contacted", "qualified", "proposal_sent", "won", "lost"]).optional(),
  referralQuality: z.number().int().min(1).max(5).optional(),
  notes: z.string().optional(),
  convertedLeadId: z.string().optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ referralId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { referralId } = await params;
  const existing = await db.leadReferral.findUnique({ where: { id: referralId } });
  if (!existing) return NextResponse.json({ error: "Referral not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const referral = await db.leadReferral.update({
    where: { id: referralId },
    data: {
      ...(parsed.data.status != null && { status: parsed.data.status }),
      ...(parsed.data.referralQuality != null && { referralQuality: parsed.data.referralQuality }),
      ...(parsed.data.notes != null && { notes: parsed.data.notes }),
      ...(parsed.data.convertedLeadId !== undefined && { convertedLeadId: parsed.data.convertedLeadId }),
    },
  });
  return NextResponse.json(referral);
}
