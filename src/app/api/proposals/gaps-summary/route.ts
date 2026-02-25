/**
 * GET /api/proposals/gaps-summary — Proposal hygiene gaps.
 */
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { withSummaryCache } from "@/lib/http/cached-handler";

export const dynamic = "force-dynamic";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET() {
  return withRouteTiming("GET /api/proposals/gaps-summary", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    return withSummaryCache("proposals/gaps-summary", async () => {
      const cutoff = new Date(Date.now() - SEVEN_DAYS_MS);

    const [readyNotSent, sentNoResponseOver7d, acceptedNoProject] = await Promise.all([
      db.proposal.count({ where: { status: "ready" } }),
      db.proposal.count({
        where: {
          status: "sent",
          sentAt: { lt: cutoff },
          respondedAt: null,
        },
      }),
      db.proposal.count({
        where: {
          status: "accepted",
          deliveryProjects: { none: {} },
        },
      }),
    ]);

    const draftsIncomplete = await db.proposal.count({
      where: {
        status: "draft",
        OR: [
          { summary: null },
          { scopeOfWork: null },
          { cta: null },
          { deliverables: { equals: Prisma.JsonNull } },
        ],
      },
    });

      return {
        readyNotSent,
        sentNoResponseOver7d,
        draftsIncomplete,
        acceptedNoProject,
      };
    }, 15_000);
  });
}
