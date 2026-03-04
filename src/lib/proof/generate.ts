/**
 * Generate proof draft (headline, summary, campaign tags) for a paid project.
 * Fires when paymentStatus → paid. Observational only (Axioms §8).
 */

import { db } from "@/lib/db";
import { chat } from "@/lib/llm";
import { safeParseJSON } from "@/lib/llm/safe-parse-json";

/** Axioms §8: Proof must be observational, no hype, no invented numbers. */
const PROOF_GENERATION_RULES = `
RULES (non-negotiable):
- Observational only: "What I saw → what changed → result." No superiority, no "I know better."
- No hype: no guarantee, 100%, act now, best-in-class, limited time, exclusive.
- No invented metrics: use "approx" or omit when unknown.
- Specific and outcome-based. Non-judgmental.
- Headline max 120 chars. Summary 2-4 sentences. Campaign tags: 2-4 lowercase slugs (e.g. nextjs, dashboard, local-business).
`;

export type ProofDraft = {
  headline: string;
  summary: string;
  campaignTags: string[];
};

/**
 * Generate proof draft from project + lead context.
 * Returns null if project has no usable context (e.g. no lead, no artifacts).
 */
export async function generateProofDraft(projectId: string): Promise<ProofDraft | null> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      lead: {
        include: {
          artifacts: {
            where: {
              OR: [
                { type: "enrichment", title: "AI Enrichment Report" },
                { type: "notes", title: "AI Enrichment Report" },
                { type: "positioning", title: "POSITIONING_BRIEF" },
                { type: "proposal" },
              ],
            },
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
      },
    },
  });

  if (!project) return null;

  const lead = project.lead;
  const enrichment = lead?.artifacts?.find(
    (a) => (a.type === "enrichment" || a.type === "notes") && a.title === "AI Enrichment Report"
  );
  const positioning = lead?.artifacts?.find(
    (a) => a.type === "positioning" && a.title === "POSITIONING_BRIEF"
  );
  const proposal = lead?.artifacts?.find((a) => a.type === "proposal");

  const contextParts: string[] = [];
  contextParts.push(`Project: ${project.name}`);
  contextParts.push(`Tech stack: ${project.techStack?.join(", ") ?? "—"}`);
  if (project.description) contextParts.push(`Description: ${project.description.slice(0, 500)}`);
  if (enrichment?.content) contextParts.push(`Enrichment (excerpt): ${enrichment.content.slice(0, 600)}`);
  if (positioning?.content) contextParts.push(`Positioning (excerpt): ${positioning.content.slice(0, 600)}`);
  if (proposal?.content) contextParts.push(`Proposal (excerpt): ${proposal.content.slice(0, 400)}`);

  const context = contextParts.join("\n\n");

  const prompt = `You are drafting a proof page for a freelance developer's portfolio. Observational case study format.

${PROOF_GENERATION_RULES}

Context:
${context}

Return a JSON object with:
- headline: string (max 120 chars, outcome-focused, no hype)
- summary: string (2-4 sentences: problem → what we built → result. Observational.)
- campaignTags: string[] (2-4 lowercase slugs for filtering, e.g. nextjs, react, dashboard, local-business, saas)

Return ONLY valid JSON, no markdown.`;

  try {
    const result = await chat(
      [{ role: "user", content: prompt }],
      { model: "gpt-4o-mini", temperature: 0.5, max_tokens: 512 }
    );

    const parsed = safeParseJSON<{ headline?: string; summary?: string; campaignTags?: string[] }>(
      result.content
    );
    if (!parsed) return null;

    const headline = (parsed.headline ?? project.name).slice(0, 120);
    const summary = (parsed.summary ?? "").trim().slice(0, 2000);
    const campaignTags = Array.isArray(parsed.campaignTags)
      ? parsed.campaignTags
        .map((t) => String(t).toLowerCase().trim().replace(/\s+/g, "-"))
        .filter((t) => t.length > 0)
        .slice(0, 6)
      : [];

    return { headline, summary, campaignTags };
  } catch {
    return null;
  }
}
