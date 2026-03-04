import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

/**
 * GET /api/decisions
 * Returns leads needing human review: ACCEPT/MAYBE with positioning or proposal, not yet approved.
 * Relaxed artifact filter: includes MAYBE leads with positioning-only (no proposal).
 * ?tab=pending (default) | ?tab=snoozed (future: when decisionSnoozedUntil exists)
 */
export async function GET(req: NextRequest) {
  return withRouteTiming("GET /api/decisions", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const url = new URL(req.url);
    const tab = url.searchParams.get("tab") || "pending";

    const where = {
      status: { not: "REJECTED" as const },
      approvedAt: null,
      scoreVerdict: { in: ["ACCEPT", "MAYBE"] as string[] },
      artifacts: {
        some: {
          type: { in: ["positioning", "proposal"] as string[] },
        },
      },
    };

    // Snoozed tab: not implemented yet (requires decisionSnoozedUntil on Lead)
    if (tab === "snoozed") {
      return NextResponse.json({ leads: [] }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
    }

    const leads = await db.lead.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        artifacts: {
          select: { type: true, title: true },
        },
      },
    });

    const result = leads.map((l) => {
      const arts = (l as { artifacts: { type: string; title: string | null }[] }).artifacts;
      const hasProposal = arts.some((a: { type: string }) => a.type === "proposal");
      const hasPositioning = arts.some(
        (a: { type: string; title: string | null }) => a.type === "positioning" && a.title === "POSITIONING_BRIEF"
      );
      const { artifacts: _a, ...rest } = l as typeof l & { artifacts: unknown[] };
      return {
        ...rest,
        hasProposal,
        hasPositioning,
      };
    });

    return NextResponse.json(
      { leads: result },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  });
}
