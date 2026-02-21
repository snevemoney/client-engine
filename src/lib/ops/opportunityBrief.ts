/**
 * Build OpportunityBrief from lead + artifacts (enrichment, positioning, research).
 * Used for lead detail and proposal ranking.
 */

import { db } from "@/lib/db";
import type { OpportunityBrief } from "./types";

export async function getOpportunityBriefForLead(leadId: string): Promise<OpportunityBrief | null> {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    include: {
      artifacts: {
        where: {
          type: { in: ["notes", "positioning", "research"] },
        },
        select: { type: true, title: true, content: true },
      },
    },
  });
  if (!lead) return null;

  const enrich = lead.artifacts.find((a) => a.type === "notes" && a.title === "AI Enrichment Report");
  const positioning = lead.artifacts.find((a) => a.type === "positioning" && a.title === "POSITIONING_BRIEF");
  const research = lead.artifacts.find((a) => a.type === "research" && a.title === "RESEARCH_SNAPSHOT");

  const contentToBrief = (content: string): Partial<OpportunityBrief> => {
    const lines = content.split("\n").filter(Boolean);
    const getSection = (key: string) => {
      const i = lines.findIndex((l) => l.includes(key));
      if (i < 0) return null;
      return lines.slice(i + 1).find((l) => l.trim() && !l.startsWith("#") && !l.startsWith("**"))
        ?.replace(/^[-*]\s*/, "")
        .trim() ?? null;
    };
    return {
      buyer: getSection("Buyer") ?? getSection("buyer") ?? null,
      pain: getSection("Pain") ?? getSection("pain") ?? getSection("Problem") ?? null,
      currentStackSignals: getSection("stack") ?? getSection("Stack") ?? null,
      likelyBottleneck: getSection("bottleneck") ?? getSection("Bottleneck") ?? null,
      offerFit: getSection("fit") ?? getSection("Fit") ?? getSection("offer") ?? null,
      roiCostOfInaction: getSection("ROI") ?? getSection("cost of inaction") ?? null,
      pilotSuggestion: getSection("pilot") ?? getSection("Pilot") ?? null,
      objectionsRisks: getSection("objection") ?? getSection("risk") ?? null,
      whyNow: getSection("why now") ?? getSection("Why now") ?? getSection("urgency") ?? null,
    };
  };

  const fromEnrich = enrich ? contentToBrief(enrich.content) : {};
  const fromPos = positioning ? contentToBrief(positioning.content) : {};
  const fromResearch = research ? { sourceEvidence: research.content.slice(0, 500) } : {};

  return {
    buyer: fromEnrich.buyer ?? fromPos.buyer ?? null,
    pain: fromEnrich.pain ?? fromPos.pain ?? lead.description?.slice(0, 300) ?? null,
    currentStackSignals: fromEnrich.currentStackSignals ?? fromPos.currentStackSignals ?? (lead.techStack?.length ? lead.techStack.join(", ") : null),
    likelyBottleneck: fromEnrich.likelyBottleneck ?? fromPos.likelyBottleneck ?? null,
    offerFit: fromEnrich.offerFit ?? fromPos.offerFit ?? null,
    roiCostOfInaction: fromEnrich.roiCostOfInaction ?? fromPos.roiCostOfInaction ?? null,
    pilotSuggestion: fromEnrich.pilotSuggestion ?? fromPos.pilotSuggestion ?? null,
    objectionsRisks: fromEnrich.objectionsRisks ?? fromPos.objectionsRisks ?? null,
    confidenceScore: lead.score ?? null,
    whyNow: fromEnrich.whyNow ?? fromPos.whyNow ?? fromResearch.sourceEvidence ?? null,
    sourceEvidence: fromResearch.sourceEvidence ?? (research ? research.content.slice(0, 300) : null),
  };
}
