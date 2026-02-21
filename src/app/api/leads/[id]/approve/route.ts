import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Set lead to APPROVED so Build can run. Requires at least one proposal artifact.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const lead = await db.lead.findUnique({
    where: { id },
    include: { artifacts: { where: { type: "proposal" }, take: 1 } },
  });

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (!lead.artifacts?.length) {
    return NextResponse.json(
      { error: "No proposal artifact. Generate a proposal before approving." },
      { status: 400 }
    );
  }

  const updated = await db.lead.update({
    where: { id },
    data: { status: "APPROVED", approvedAt: new Date() },
  });

  return NextResponse.json(updated);
}
