import { db } from "@/lib/db";
import { chat, type ChatUsage } from "@/lib/llm";
import { buildProposalPrompt } from "@/lib/pipeline/prompts/buildProposalPrompt";
import { isDryRun } from "@/lib/pipeline/dry-run";
import type { Provenance } from "@/lib/pipeline/provenance";
import { getLeadRoiEstimate } from "@/lib/revenue/roi";
import { getClientSuccessData } from "@/lib/client-success";
import { getLeadIntelligenceForLead } from "@/lib/pipeline/getLeadIntelligenceForLead";

const POSITIONING_ARTIFACT_TITLE = "POSITIONING_BRIEF";
const RESEARCH_SNAPSHOT_TITLE = "RESEARCH_SNAPSHOT";

/**
 * Run proposal step. Requires a positioning artifact for this lead (gate: no proposal without positioning).
 */
export async function runPropose(leadId: string, provenance?: Provenance): Promise<{ artifactId: string; usage?: ChatUsage }> {
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error("Lead not found");

  const positioning = await db.artifact.findFirst({
    where: {
      leadId,
      type: "positioning",
      title: POSITIONING_ARTIFACT_TITLE,
    },
  });

  if (!positioning) {
    throw new Error(
      "Proposal requires POSITIONING_BRIEF. Run position step first."
    );
  }

  const research = await db.artifact.findFirst({
    where: { leadId, type: "research", title: RESEARCH_SNAPSHOT_TITLE },
  });
  const researchMeta = research?.meta as { sourceUrl?: string; capturedAt?: string } | null;
  const researchSnapshot = research?.content ?? null;
  const researchSourceUrl = researchMeta?.sourceUrl ?? null;

  const roi = await getLeadRoiEstimate(leadId);
  const roiSummary = roi
    ? [roi.meta.whyNow, roi.meta.pilotRecommendation, ...roi.meta.expectedPilotOutcome.map((b) => `- ${b}`)].join("\n\n")
    : null;

  const successData = await getClientSuccessData(leadId);
  const resultTarget = successData.resultTarget ?? null;

  const leadIntelligence = await getLeadIntelligenceForLead(leadId);

  const proposalRiskSummary = leadIntelligence
    ? {
        adoptionRiskLevel: leadIntelligence.adoptionRisk?.level ?? "unknown",
        toolLoyaltyRiskLevel: leadIntelligence.toolLoyaltyRisk?.level ?? "unknown",
        reversibilityLevel: (leadIntelligence.reversibility as { level?: string })?.level ?? leadIntelligence.reversibility?.strategy ?? "unknown",
        primaryBuyer:
          (leadIntelligence.stakeholderMap ?? []).find((s) => s.role?.toLowerCase().includes("buyer"))?.role ??
          (leadIntelligence.stakeholderMap ?? [])[0]?.role ??
          "unknown",
        hasLikelyBlockers:
          (leadIntelligence.stakeholderMap ?? []).some((s) =>
            ["blocker", "skeptical", "resistant"].some((k) => (s.role?.toLowerCase() ?? "").includes(k) || (s.stance ?? "").toLowerCase().includes(k))
          ),
      }
    : null;

  const meta: Record<string, unknown> = {
    ...(provenance ? { provenance } : {}),
    leadIntelligenceUsed: leadIntelligence ?? null,
    ...(proposalRiskSummary ? { proposalRiskSummary } : {}),
  };
  if (isDryRun()) {
    const artifact = await db.artifact.create({
      data: {
        leadId,
        type: "proposal",
        title: `Proposal: ${lead.title}`,
        content: "**[DRY RUN]** Placeholder proposal.",
        meta: meta as object,
      },
    });
    return { artifactId: artifact.id };
  }

  const prompt = buildProposalPrompt(
    {
      title: lead.title,
      description: lead.description,
      budget: lead.budget,
      timeline: lead.timeline,
      platform: lead.platform,
      techStack: lead.techStack,
      researchSnapshot: researchSnapshot ?? undefined,
      researchSourceUrl: researchSourceUrl ?? undefined,
      roiSummary: roiSummary ?? undefined,
      resultTarget: resultTarget ?? undefined,
      leadIntelligence: leadIntelligence ?? undefined,
    },
    positioning.content
  );

  const { content, usage } = await chat(
    [
      {
        role: "system",
        content:
          "You are an expert proposal writer for a freelance developer. Write compelling, specific, positioning-first proposals.",
      },
      { role: "user", content: prompt },
    ],
    { model: "gpt-4o-mini", temperature: 0.6, max_tokens: 2048 }
  );

  const artifact = await db.artifact.create({
    data: {
      leadId,
      type: "proposal",
      title: `Proposal: ${lead.title}`,
      content,
      meta: meta as object,
    },
  });

  return { artifactId: artifact.id, usage };
}
