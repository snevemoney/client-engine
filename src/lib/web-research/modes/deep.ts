import type { WebResearchRequest, ScrapedPage, DeepResearchBrief } from "../types";
import type { ChatUsage } from "@/lib/llm";
import { searchAndScrape } from "../scraper";
import { generateSearchQueries, synthesizeDeep, mergeUsage } from "../synthesize";

type LeadContext = {
  title: string;
  description?: string;
  techStack?: string[];
};

/**
 * Orchestrate deep research for a lead/topic.
 * 1. Generate 2-3 search queries from context
 * 2. Search & scrape across all queries
 * 3. Deduplicate pages
 * 4. Synthesize into DeepResearchBrief
 */
export async function runDeepResearch(
  request: WebResearchRequest,
  leadContext: LeadContext,
): Promise<{ brief: DeepResearchBrief; pages: ScrapedPage[]; usage: ChatUsage }> {
  const context = request.query ?? `${leadContext.title}. ${leadContext.description ?? ""}`;
  const maxSources = request.maxSources ?? 8;

  // Generate search queries
  const { queries, usage: queryUsage } = await generateSearchQueries(context, "deep", 3);

  // Search & scrape across all queries, dedup by URL
  const allPages: ScrapedPage[] = [];
  const seenUrls = new Set<string>();

  for (const query of queries) {
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
    throw new Error("No pages could be scraped for deep research");
  }

  // Synthesize
  const { brief, usage: synthUsage } = await synthesizeDeep(allPages, {
    title: leadContext.title,
    description: leadContext.description,
  });

  return {
    brief,
    pages: allPages,
    usage: mergeUsage(queryUsage, synthUsage),
  };
}
