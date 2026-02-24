/**
 * POST /api/proposals/[id]/duplicate — Clone as new draft.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/proposals/[id]/duplicate", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const proposal = await db.proposal.findUnique({ where: { id } });
    if (!proposal) return jsonError("Proposal not found", 404);

    const baseTitle = proposal.title.trim();
    const copyMatch = baseTitle.match(/ \(copy (\d+)\)$/);
    const nextNum = copyMatch ? parseInt(copyMatch[1], 10) + 1 : 1;
    const base = copyMatch ? baseTitle.slice(0, -copyMatch[0].length) : baseTitle;
    const newTitle = `${base} (copy ${nextNum})`;

    const created = await db.proposal.create({
      data: {
        intakeLeadId: proposal.intakeLeadId ?? undefined,
        pipelineLeadId: proposal.pipelineLeadId ?? undefined,
        status: "draft",
        title: newTitle,
        clientName: proposal.clientName ?? undefined,
        clientEmail: proposal.clientEmail ?? undefined,
        company: proposal.company ?? undefined,
        summary: proposal.summary ?? undefined,
        scopeOfWork: proposal.scopeOfWork ?? undefined,
        deliverables: proposal.deliverables ?? undefined,
        timelineDays: proposal.timelineDays ?? undefined,
        priceType: proposal.priceType ?? undefined,
        priceMin: proposal.priceMin ?? undefined,
        priceMax: proposal.priceMax ?? undefined,
        priceCurrency: proposal.priceCurrency ?? "CAD",
        terms: proposal.terms ?? undefined,
        cta: proposal.cta ?? undefined,
        expiresAt: proposal.expiresAt ?? undefined,
        version: 1,
        createdBy: session.user.id ?? undefined,
      },
      include: {
        intakeLead: { select: { id: true, title: true, status: true } },
        pipelineLead: { select: { id: true, title: true, status: true } },
      },
    });

    await db.proposalActivity.create({
      data: {
        proposalId: created.id,
        type: "created",
        message: `Duplicated from proposal ${id}`,
        metaJson: { sourceProposalId: id },
      },
    });

    return NextResponse.json(
      {
        id: created.id,
        title: created.title,
        status: created.status,
        createdAt: created.createdAt.toISOString(),
      },
      { status: 201 }
    );
  });
}
