import type { ScrapedPage } from "./types";

/**
 * Build the {SOURCES_BLOCK} content from scraped pages.
 * Each source formatted with clear delimiters for the LLM.
 */
export function buildSourcesBlock(pages: ScrapedPage[]): string {
  return pages
    .map(
      (p, i) =>
        `--- Source ${i + 1}: ${p.title} (${p.domain}) ---\n${p.content.slice(0, 3000)}\n---`,
    )
    .join("\n\n");
}

// ── Query Generation ──

export const QUERY_GENERATION_SYSTEM =
  "You generate concise, effective search queries. Return ONLY a JSON array of strings. No markdown fences, no explanation.";

export function queryGenerationUser(context: string, mode: string, count: number): string {
  return `Given this context, generate ${count} specific Google search queries to research it.

Context: ${context}
Research mode: ${mode}

Return a JSON array of ${count} query strings. Make them specific and varied — cover different angles.`;
}

// ── Deep Research ──

export const DEEP_RESEARCH_SYSTEM = `You are a thorough research analyst. You synthesize information from multiple web sources into clear, actionable research briefs. You ONLY cite information that appears in the provided sources. You never fabricate facts or citations.`;

export function deepResearchUser(
  title: string,
  description: string,
  sourcesBlock: string,
): string {
  return `Research brief for: ${title}
Context: ${description}

Sources scraped (use these as your ONLY factual basis):
${sourcesBlock}

Produce a JSON object with this exact structure:
{
  "summary": "2-3 paragraph overview of findings",
  "keyFindings": [{ "finding": "...", "source": "domain.com", "confidence": "high|medium|low" }],
  "opportunities": ["..."],
  "risks": ["..."],
  "recommendations": ["actionable recommendation 1", "..."],
  "citations": [{ "url": "full url", "title": "page title", "domain": "domain.com", "relevance": "high|medium|low" }]
}

Rules:
- Only cite information that appears in the sources above. Never fabricate.
- "confidence" = how clearly the source supports the finding.
- Minimum 3 keyFindings, 2 recommendations, 1 citation.
- Summary first sentence states the most important conclusion.
- "recommendations" array: plain text only, do NOT number items (e.g. write "Develop a plan" not "1. Develop a plan").
- Return ONLY valid JSON. No markdown fences.`;
}

// ── Competitive Research ──

export const COMPETITIVE_RESEARCH_SYSTEM = `You are a competitive intelligence analyst. You identify market positioning, competitor strengths/weaknesses, and differentiation opportunities. You ONLY cite information from provided sources. You never fabricate.`;

export function competitiveResearchUser(
  targetName: string,
  targetUrl: string,
  targetContent: string,
  description: string,
  sourcesBlock: string,
): string {
  return `Competitive analysis for: ${targetName} (${targetUrl})
Lead context: ${description}

Target company page content:
${targetContent.slice(0, 3000)}

Competitor and market sources:
${sourcesBlock}

Produce a JSON object with this exact structure:
{
  "targetCompany": { "name": "...", "url": "...", "description": "...", "positioning": "..." },
  "competitors": [{ "name": "...", "url": "...", "positioning": "...", "strengths": ["..."], "weaknesses": ["..."], "pricing": "...", "techStack": ["..."] }],
  "marketGaps": ["..."],
  "differentiationAngles": ["..."],
  "recommendations": ["..."],
  "citations": [{ "url": "...", "title": "...", "domain": "...", "relevance": "high|medium|low" }]
}

Rules:
- Identify 3-5 competitors from the sources.
- Be specific about positioning differences, not generic.
- differentiationAngles = how to position against these competitors.
- "recommendations" array: plain text only, do NOT number items.
- Return ONLY valid JSON. No markdown fences.`;
}

// ── Technical Research ──

export const TECHNICAL_RESEARCH_SYSTEM = `You are a senior software architect doing technology research. You evaluate tech stacks, architecture patterns, and best practices with specific, actionable advice. You ONLY cite information from provided sources. You never fabricate.`;

export function technicalResearchUser(
  title: string,
  techContext: string,
  techStack: string[],
  sourcesBlock: string,
): string {
  return `Technical research for: ${title}
Tech context: ${techContext}
Current stack: ${techStack.length > 0 ? techStack.join(", ") : "not specified"}

Technical sources:
${sourcesBlock}

Produce a JSON object with this exact structure:
{
  "summary": "overview of architectural landscape and key decisions",
  "bestPractices": [{ "practice": "...", "rationale": "...", "source": "domain.com" }],
  "architectureNotes": ["..."],
  "toolComparisons": [{ "tool": "...", "pros": ["..."], "cons": ["..."], "recommendation": "..." }],
  "recommendations": ["..."],
  "citations": [{ "url": "...", "title": "...", "domain": "...", "relevance": "high|medium|low" }]
}

Rules:
- Focus on actionable architecture decisions, not generic advice.
- Compare relevant tools with specifics (not just "it depends").
- Minimum 3 bestPractices, 2 recommendations.
- "recommendations" array: plain text only, do NOT number items.
- Return ONLY valid JSON. No markdown fences.`;
}
