/**
 * Signal-to-Prospect opportunity matcher.
 * Scores signal tags against prospect niche/platform to find outreach targets.
 */
import { db } from "@/lib/db";
import { NICHE_CONTEXT } from "@/lib/niche/context";

type MatchResult = {
  prospectId: string;
  prospectName: string;
  niche: string | null;
  platform: string;
  relevanceScore: number;
  matchedTags: string[];
  suggestedTemplateKey: string;
  dealId?: string;
  dealStage?: string;
};

type MatchOptions = {
  topK?: number;
};

/**
 * Match a signal item to prospects. Scores by niche keyword overlap,
 * platform affinity, and opportunity score. Returns ranked matches.
 */
export async function matchSignalToProspects(
  signalItemId: string,
  options: MatchOptions = {}
): Promise<{ signalId: string; signalTitle: string; matches: MatchResult[] }> {
  const topK = options.topK ?? 5;

  const signal = await db.signalItem.findUnique({
    where: { id: signalItemId },
  });
  if (!signal) throw new Error(`SignalItem not found: ${signalItemId}`);

  const prospects = await db.prospect.findMany({
    include: {
      deals: {
        select: { id: true, stage: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    take: 100,
  });

  const signalText = `${signal.title} ${signal.summary ?? ""}`.toLowerCase();
  const signalTags = signal.tags.map((t) => t.toLowerCase());

  const scored: MatchResult[] = [];

  for (const prospect of prospects) {
    let score = 0;
    const matchedTags: string[] = [];

    // Niche keyword match (signal tags vs prospect niche)
    if (prospect.niche) {
      const nicheWords = prospect.niche.toLowerCase().split(/\s+/);
      for (const tag of signalTags) {
        if (nicheWords.some((w) => tag.includes(w) || w.includes(tag))) {
          score += 20;
          matchedTags.push(tag);
        }
      }
      // Check if signal text mentions prospect niche
      if (signalText.includes(prospect.niche.toLowerCase())) {
        score += 15;
      }
    }

    // Niche context alignment (does signal mention our target niches?)
    for (const niche of NICHE_CONTEXT.specificNiches) {
      const nicheKey = niche.toLowerCase().split(" ")[0]; // "med", "dental", etc.
      if (signalText.includes(nicheKey) && prospect.niche?.toLowerCase().includes(nicheKey)) {
        score += 10;
        if (!matchedTags.includes(nicheKey)) matchedTags.push(nicheKey);
      }
    }

    // Follow-up leakage signal boost
    if (signalText.includes("follow-up") || signalText.includes("follow up") || signalText.includes("response time")) {
      score += 10;
      if (!matchedTags.includes("follow-up")) matchedTags.push("follow-up");
    }

    // Opportunity score boost
    if (prospect.opportunityScore) {
      score += prospect.opportunityScore * 2; // 0-20 points
    }

    // Penalty for prospects already in late deal stages
    const latestDeal = prospect.deals[0];
    if (latestDeal && ["won", "lost", "proposal_sent"].includes(latestDeal.stage)) {
      score -= 20;
    }

    if (score > 0) {
      scored.push({
        prospectId: prospect.id,
        prospectName: prospect.name,
        niche: prospect.niche,
        platform: prospect.platform,
        relevanceScore: Math.min(100, score),
        matchedTags,
        suggestedTemplateKey: suggestTemplate(prospect, signalTags),
        dealId: latestDeal?.id,
        dealStage: latestDeal?.stage,
      });
    }
  }

  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return {
    signalId: signal.id,
    signalTitle: signal.title,
    matches: scored.slice(0, topK),
  };
}

function suggestTemplate(
  prospect: { currentWebPresence?: string | null; niche?: string | null },
  signalTags: string[]
): string {
  const web = (prospect.currentWebPresence ?? "").toLowerCase();

  if (signalTags.includes("follow-up") || signalTags.includes("appointment")) {
    return "followup_leakage_audit";
  }
  if (web.includes("canva") || web.includes("wix")) {
    return "canva_site_upgrade";
  }
  if (web.includes("linktree") || web.includes("linktr")) {
    return "linktree_cleanup";
  }
  if (web.includes("google form")) {
    return "google_form_upgrade";
  }
  if (!web || web === "none") {
    return "big_audience_no_site";
  }
  return "proof_driven_intro";
}
