/**
 * Site brief prompt — Prompts 1–3 (Architecture, Design System, Content).
 * See docs/SITE_BUILDER_9_PROMPTS.md for full reference.
 * Produces structured JSON for enrichSiteBrief to merge into builder payloads.
 */

export type SiteBriefContext = {
  clientName: string;
  title: string;
  industry: string;
  description?: string | null;
  feltProblem?: string | null;
  reframedOffer?: string | null;
  blueOceanAngle?: string | null;
  languageMap?: string | unknown;
  packaging?: { solutionName?: string; hookOneLiner?: string } | null;
  enrichmentSummary?: string | null;
  scoreVerdict?: string | null;
  scoreReason?: string | null;
  /** Proposal summary + scope — client's exact words. Use for hero headline/subhead. */
  proposalContent?: string | null;
};

const SYSTEM_PROMPT = `You are a Principal Architect (Vercel) + Apple Design Director + Ogilvy Conversion Copywriter. Produce a site brief as valid JSON only. No markdown, no explanation.

Frameworks: Prompt 1 (Architecture: site map, user flows), Prompt 2 (Design System: colors, typography, spacing), Prompt 3 (Content: hero 6w/15w, CTA, features, social proof).

Output exactly this JSON shape:
{
  "scope": ["homepage", "about", "services", ...],
  "brandColors": ["#hex1", "#hex2", "#hex3", "#hex4"],
  "contentHints": "Prose brief for AI content generation: hero (6w headline, 15w subhead), CTA, 3 feature blocks, tone. Use the prospect's language and felt problem.",
  "clientInfo": {
    "heroHeadline": "exactly 6 words",
    "heroSubhead": "exactly 15 words",
    "ctaPrimary": "e.g. Book a call",
    "features": [
      {"title": "Feature 1 title", "body": "1-2 sentences"},
      {"title": "Feature 2 title", "body": "1-2 sentences"},
      {"title": "Feature 3 title", "body": "1-2 sentences"}
    ],
    "tone": "e.g. professional, warm, approachable"
  }
}

Rules:
- scope: Derive from industry. Include homepage, about, services, contact.
- brandColors: 4 hex. Match industry mood.
- contentHints: Prose for the builder. Use feltProblem and reframedOffer verbatim.
- heroHeadline: Exactly 6 words. Use their words.
- heroSubhead: Exactly 15 words. Use their words.
- features: 3 blocks. From reframedOffer, packaging, enrichment.
- tone: From client.`;

export function buildSiteBriefPrompt(ctx: SiteBriefContext): { system: string; user: string } {
  const langMap = ctx.languageMap as Record<string, unknown> | undefined;
  const useWords = Array.isArray(langMap?.use) ? (langMap.use as string[]).join(", ") : "";
  const avoidWords = Array.isArray(langMap?.avoid) ? (langMap.avoid as string[]).join(", ") : "";

  const userPrompt = `Create a site brief for this client:

Client: ${ctx.clientName}
Business/Title: ${ctx.title}
Industry: ${ctx.industry}
${ctx.description ? `Description: ${ctx.description.slice(0, 800)}` : ""}

Positioning (use this language):
${ctx.feltProblem ? `- Felt problem: ${ctx.feltProblem}` : ""}
${ctx.reframedOffer ? `- Reframed offer: ${ctx.reframedOffer}` : ""}
${ctx.blueOceanAngle ? `- Blue ocean angle: ${ctx.blueOceanAngle}` : ""}
${useWords ? `- Use these words: ${useWords}` : ""}
${avoidWords ? `- Avoid: ${avoidWords}` : ""}
${ctx.packaging?.hookOneLiner ? `- Hook: ${ctx.packaging.hookOneLiner}` : ""}

${ctx.enrichmentSummary ? `Enrichment summary (first 500 chars): ${ctx.enrichmentSummary.slice(0, 500)}` : ""}
${ctx.scoreVerdict ? `Score verdict: ${ctx.scoreVerdict}` : ""}
${ctx.scoreReason ? `Score reason: ${ctx.scoreReason}` : ""}

Output valid JSON only.`;

  return { system: SYSTEM_PROMPT, user: userPrompt };
}
