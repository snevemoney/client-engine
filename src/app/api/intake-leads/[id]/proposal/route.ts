/**
 * POST /api/intake-leads/[id]/proposal — Generate proposal draft from intake.
 * Idempotent: createNew=false returns latest draft if exists.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProposalPriceType } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { buildProposalDraftFromIntake } from "@/lib/proposals/draft-from-intake";

const PostSchema = z.object({
  createNew: z.boolean().optional().default(true),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/intake-leads/[id]/proposal", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const intake = await db.intakeLead.findUnique({ where: { id } });
    if (!intake) return jsonError("Intake lead not found", 404);

    const raw = await req.json().catch(() => ({}));
    const parsed = PostSchema.safeParse(raw);
    const createNew = parsed.success ? parsed.data.createNew : true;

    if (!createNew && intake.latestProposalId) {
      const existing = await db.proposal.findUnique({
        where: { id: intake.latestProposalId },
        include: {
          intakeLead: { select: { id: true, title: true, status: true } },
        },
      });
      if (existing && existing.status === "draft") {
        return NextResponse.json({
          id: existing.id,
          title: existing.title,
          status: existing.status,
          createdAt: existing.createdAt.toISOString(),
          message: "Returned existing draft",
        });
      }
    }

    const draft = buildProposalDraftFromIntake({
      title: intake.title,
      company: intake.company ?? null,
      contactName: intake.contactName ?? null,
      contactEmail: intake.contactEmail ?? null,
      summary: intake.summary ?? null,
      budgetMin: intake.budgetMin ?? null,
      budgetMax: intake.budgetMax ?? null,
    });

    const proposal = await db.proposal.create({
      data: {
        intakeLeadId: id,
        status: "draft",
        title: draft.title,
        clientName: draft.clientName ?? undefined,
        clientEmail: draft.clientEmail ?? undefined,
        company: draft.company ?? undefined,
        summary: draft.summary,
        scopeOfWork: draft.scopeOfWork,
        deliverables: draft.deliverables,
        cta: draft.cta,
        priceType: draft.priceType as ProposalPriceType,
        priceMin: draft.priceMin ?? undefined,
        priceMax: draft.priceMax ?? undefined,
        priceCurrency: draft.priceCurrency ?? "CAD",
        createdBy: session.user.id ?? undefined,
      },
      include: {
        intakeLead: { select: { id: true, title: true, status: true } },
      },
    });

    await db.proposalActivity.create({
      data: {
        proposalId: proposal.id,
        type: "created",
        message: "Created from intake lead",
        metaJson: { intakeLeadId: id },
      },
    });

    await db.intakeLead.update({
      where: { id },
      data: {
        proposalCount: { increment: 1 },
        latestProposalId: proposal.id,
      },
    });

    return NextResponse.json(
      {
        id: proposal.id,
        title: proposal.title,
        status: proposal.status,
        createdAt: proposal.createdAt.toISOString(),
        clientName: proposal.clientName,
        company: proposal.company,
      },
      { status: 201 }
    );
  });
}
