/**
 * POST /api/proposals/[id]/snapshot — Force-create new version snapshot.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { buildProposalSnapshot, nextProposalVersion } from "@/lib/proposals/versioning";

const PostSchema = z.object({
  changeNote: z.string().max(500).optional().nullable(),
});

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/proposals/[id]/snapshot", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const proposal = await db.proposal.findUnique({ where: { id } });
    if (!proposal) return jsonError("Proposal not found", 404);

    const raw = await _req.json().catch(() => ({}));
    const parsed = PostSchema.safeParse(raw);
    const changeNote = parsed.success && parsed.data.changeNote ? parsed.data.changeNote : null;

    const nextVer = nextProposalVersion(proposal.version);
    const snapshot = buildProposalSnapshot({
      title: proposal.title,
      clientName: proposal.clientName,
      clientEmail: proposal.clientEmail,
      company: proposal.company,
      summary: proposal.summary,
      scopeOfWork: proposal.scopeOfWork,
      deliverables: proposal.deliverables,
      timelineDays: proposal.timelineDays,
      priceType: proposal.priceType,
      priceMin: proposal.priceMin,
      priceMax: proposal.priceMax,
      priceCurrency: proposal.priceCurrency,
      terms: proposal.terms,
      cta: proposal.cta,
      expiresAt: proposal.expiresAt?.toISOString() ?? null,
      version: proposal.version,
      lastEditedAt: proposal.lastEditedAt?.toISOString() ?? null,
    });

    await db.$transaction([
      db.proposalVersion.create({
        data: {
          proposalId: id,
          version: nextVer,
          snapshotJson: snapshot,
          changeNote: changeNote ?? undefined,
        },
      }),
      db.proposal.update({
        where: { id },
        data: { version: nextVer },
      }),
      db.proposalActivity.create({
        data: {
          proposalId: id,
          type: "edited",
          message: `Version ${nextVer} snapshot created`,
          metaJson: { changeNote },
        },
      }),
    ]);

    const updated = await db.proposal.findUnique({ where: { id } });
    return NextResponse.json({
      version: updated?.version ?? nextVer,
      message: "Snapshot created",
    });
  });
}
