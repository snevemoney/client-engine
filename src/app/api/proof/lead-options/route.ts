/**
 * GET /api/proof/lead-options — Pipeline and intake leads for proof generation dropdown.
 * Returns both scopes so Proof page can generate from either path.
 */
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { IntakeLeadStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [pipelineLeads, intakeLeads] = await Promise.all([
    db.lead.findMany({
      where: { status: { not: "REJECTED" } },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { id: true, title: true },
    }),
    db.intakeLead.findMany({
      where: {
        status: IntakeLeadStatus.won,
        proofCandidates: { some: {} },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { id: true, title: true },
    }),
  ]);

  return NextResponse.json({
    pipeline: pipelineLeads.map((l) => ({ id: l.id, title: l.title ?? "", itemType: "pipeline" as const })),
    intake: intakeLeads.map((l) => ({ id: l.id, title: l.title ?? "", itemType: "intake" as const })),
  });
}
