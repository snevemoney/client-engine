/**
 * Resolve the latest lead intelligence for a lead from enrich or positioning artifacts.
 * Used by proposal step and any consumer that needs structured risk/stakeholder data.
 */

import { db } from "@/lib/db";
import { LeadIntelligenceSchema, type LeadIntelligence } from "@/lib/lead-intelligence/schema";

const ENRICH_TITLE = "AI Enrichment Report";
const POSITIONING_TITLE = "POSITIONING_BRIEF";

export async function getLeadIntelligenceForLead(leadId: string): Promise<LeadIntelligence | null> {
  const artifacts = await db.artifact.findMany({
    where: {
      leadId,
      OR: [
        { type: "notes", title: ENRICH_TITLE },
        { type: "positioning", title: POSITIONING_TITLE },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, type: true, meta: true },
    take: 10,
  });

  for (const artifact of artifacts) {
    const meta = artifact.meta as Record<string, unknown> | null;
    const candidate = meta?.leadIntelligence;
    if (candidate == null || typeof candidate !== "object") continue;
    const parsed = LeadIntelligenceSchema.safeParse(candidate);
    if (parsed.success) return parsed.data;
  }

  return null;
}
