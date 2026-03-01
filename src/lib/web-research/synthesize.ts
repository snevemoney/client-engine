import { chat, type ChatUsage } from "@/lib/llm";
import { safeParseJSON } from "@/lib/llm/safe-parse-json";
import type {
  WebResearchMode,
  ScrapedPage,
  DeepResearchBrief,
  CompetitiveResearchBrief,
  TechnicalResearchBrief,
} from "./types";
import {
  DeepResearchBriefSchema,
  CompetitiveResearchBriefSchema,
  TechnicalResearchBriefSchema,
} from "./types";
import {
  QUERY_GENERATION_SYSTEM,
  queryGenerationUser,
  DEEP_RESEARCH_SYSTEM,
  deepResearchUser,
  COMPETITIVE_RESEARCH_SYSTEM,
  competitiveResearchUser,
  TECHNICAL_RESEARCH_SYSTEM,
  technicalResearchUser,
  buildSourcesBlock,
} from "./prompts";

export type { ChatUsage };

const MODEL = "gpt-4o-mini";
const SYNTHESIS_TEMP = 0.3;
const SYNTHESIS_MAX_TOKENS = 3000;
const QUERY_TEMP = 0.4;

/** Merge two ChatUsage objects. */
export function mergeUsage(a?: ChatUsage, b?: ChatUsage): ChatUsage {
  return {
    prompt_tokens: (a?.prompt_tokens ?? 0) + (b?.prompt_tokens ?? 0),
    completion_tokens: (a?.completion_tokens ?? 0) + (b?.completion_tokens ?? 0),
    total_tokens: (a?.total_tokens ?? 0) + (b?.total_tokens ?? 0),
  };
}

/**
 * Generate search queries using LLM.
 * Returns 2-3 search query strings.
 */
export async function generateSearchQueries(
  context: string,
  mode: WebResearchMode,
  count = 3,
): Promise<{ queries: string[]; usage?: ChatUsage }> {
  const { content, usage } = await chat(
    [
      { role: "system", content: QUERY_GENERATION_SYSTEM },
      { role: "user", content: queryGenerationUser(context, mode, count) },
    ],
    { model: MODEL, temperature: QUERY_TEMP, max_tokens: 256 },
  );

  const queries = safeParseJSON<string[]>(content);
  if (!Array.isArray(queries)) throw new Error("VALIDATION: Query generation returned non-array");

  return { queries: queries.slice(0, count), usage };
}

/**
 * Synthesize scraped pages into a deep research brief.
 */
export async function synthesizeDeep(
  pages: ScrapedPage[],
  context: { title: string; description?: string },
): Promise<{ brief: DeepResearchBrief; usage?: ChatUsage }> {
  const sourcesBlock = buildSourcesBlock(pages);

  const { content, usage } = await chat(
    [
      { role: "system", content: DEEP_RESEARCH_SYSTEM },
      {
        role: "user",
        content: deepResearchUser(context.title, context.description ?? "", sourcesBlock),
      },
    ],
    { model: MODEL, temperature: SYNTHESIS_TEMP, max_tokens: SYNTHESIS_MAX_TOKENS },
  );

  const parsed = DeepResearchBriefSchema.safeParse(safeParseJSON(content));
  if (!parsed.success) {
    throw new Error(`VALIDATION: Deep research brief invalid: ${parsed.error.message}`);
  }

  return { brief: parsed.data, usage };
}

/**
 * Synthesize scraped pages into a competitive research brief.
 */
export async function synthesizeCompetitive(
  pages: ScrapedPage[],
  context: {
    title: string;
    description?: string;
    targetUrl: string;
    targetContent?: string;
  },
): Promise<{ brief: CompetitiveResearchBrief; usage?: ChatUsage }> {
  const sourcesBlock = buildSourcesBlock(pages.filter((p) => p.url !== context.targetUrl));
  const targetPage = pages.find((p) => p.url === context.targetUrl);

  const { content, usage } = await chat(
    [
      { role: "system", content: COMPETITIVE_RESEARCH_SYSTEM },
      {
        role: "user",
        content: competitiveResearchUser(
          context.title,
          context.targetUrl,
          targetPage?.content ?? context.targetContent ?? "(no content scraped)",
          context.description ?? "",
          sourcesBlock,
        ),
      },
    ],
    { model: MODEL, temperature: SYNTHESIS_TEMP, max_tokens: SYNTHESIS_MAX_TOKENS },
  );

  const parsed = CompetitiveResearchBriefSchema.safeParse(safeParseJSON(content));
  if (!parsed.success) {
    throw new Error(`VALIDATION: Competitive research brief invalid: ${parsed.error.message}`);
  }

  return { brief: parsed.data, usage };
}

/**
 * Synthesize scraped pages into a technical research brief.
 */
export async function synthesizeTechnical(
  pages: ScrapedPage[],
  context: {
    title: string;
    description?: string;
    techStack?: string[];
    techContext?: string;
  },
): Promise<{ brief: TechnicalResearchBrief; usage?: ChatUsage }> {
  const sourcesBlock = buildSourcesBlock(pages);

  const { content, usage } = await chat(
    [
      { role: "system", content: TECHNICAL_RESEARCH_SYSTEM },
      {
        role: "user",
        content: technicalResearchUser(
          context.title,
          context.techContext ?? context.description ?? "",
          context.techStack ?? [],
          sourcesBlock,
        ),
      },
    ],
    { model: MODEL, temperature: SYNTHESIS_TEMP, max_tokens: SYNTHESIS_MAX_TOKENS },
  );

  const parsed = TechnicalResearchBriefSchema.safeParse(safeParseJSON(content));
  if (!parsed.success) {
    throw new Error(`VALIDATION: Technical research brief invalid: ${parsed.error.message}`);
  }

  return { brief: parsed.data, usage };
}
