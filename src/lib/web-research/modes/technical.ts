import type { WebResearchRequest, ScrapedPage, TechnicalResearchBrief } from "../types";
import type { ChatUsage } from "@/lib/llm";
import { searchAndScrape } from "../scraper";
import { generateSearchQueries, synthesizeTechnical, mergeUsage } from "../synthesize";

type LeadContext = {
  title: string;
  description?: string;
  techStack?: string[];
  techContext?: string;
};

/**
 * Orchestrate technical research for a tech stack/requirements.
 * 1. Generate technical search queries from tech context
 * 2. Search & scrape (biased toward docs, dev blogs)
 * 3. Synthesize into TechnicalResearchBrief
 */
export async function runTechnicalResearch(
  request: WebResearchRequest,
  leadContext: LeadContext,
): Promise<{ brief: TechnicalResearchBrief; pages: ScrapedPage[]; usage: ChatUsage }> {
  const maxSources = request.maxSources ?? 8;
  const techContext = request.techContext ?? leadContext.techContext ?? "";
  const stackStr = (leadContext.techStack ?? []).join(", ");

  const context = [
    leadContext.title,
    techContext,
    stackStr ? `Tech stack: ${stackStr}` : "",
    leadContext.description ?? "",
  ]
    .filter(Boolean)
    .join(". ");

  // Generate queries biased toward technical sources
  const { queries, usage: queryUsage } = await generateSearchQueries(context, "technical", 3);

  // Add doc-specific query patterns
  const techQueries = [
    ...queries,
    stackStr ? `${stackStr} best practices architecture` : null,
  ]
    .filter((q): q is string => q !== null)
    .slice(0, 4);

  // Search & scrape
  const allPages: ScrapedPage[] = [];
  const seenUrls = new Set<string>();

  for (const query of techQueries) {
    if (allPages.length >= maxSources) break;

    const { pages } = await searchAndScrape(query, {
      maxSources: maxSources - allPages.length,
    });

    for (const page of pages) {
      if (!seenUrls.has(page.url) && allPages.length < maxSources) {
        seenUrls.add(page.url);
        allPages.push(page);
      }
    }
  }

  if (allPages.length === 0) {
    throw new Error("No technical sources could be scraped");
  }

  // Synthesize
  const { brief, usage: synthUsage } = await synthesizeTechnical(allPages, {
    title: leadContext.title,
    description: leadContext.description,
    techStack: leadContext.techStack,
    techContext,
  });

  return {
    brief,
    pages: allPages,
    usage: mergeUsage(queryUsage, synthUsage),
  };
}
