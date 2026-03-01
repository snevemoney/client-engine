import type { WebResearchRequest, ScrapedPage, CompetitiveResearchBrief } from "../types";
import type { ChatUsage } from "@/lib/llm";
import { searchAndScrape } from "../scraper";
import { scrapeUrl } from "../scraper";
import { generateSearchQueries, synthesizeCompetitive, mergeUsage } from "../synthesize";

type LeadContext = {
  title: string;
  description?: string;
  targetUrl: string;
};

/**
 * Orchestrate competitive research for a company/URL.
 * 1. Scrape targetUrl directly
 * 2. Generate competitor-finding queries
 * 3. Search & scrape competitors
 * 4. Synthesize into CompetitiveResearchBrief
 */
export async function runCompetitiveResearch(
  request: WebResearchRequest,
  leadContext: LeadContext,
): Promise<{ brief: CompetitiveResearchBrief; pages: ScrapedPage[]; usage: ChatUsage }> {
  const maxSources = request.maxSources ?? 8;

  // Scrape target first
  const targetPage = await scrapeUrl(leadContext.targetUrl);
  const targetContent = targetPage?.content ?? "";
  const companyName =
    targetPage?.title ?? leadContext.title ?? new URL(leadContext.targetUrl).hostname;

  // Generate competitor-finding queries
  const context = `${companyName}: ${leadContext.description ?? targetContent.slice(0, 500)}`;
  const { queries, usage: queryUsage } = await generateSearchQueries(context, "competitive", 3);

  // Add competitor-specific query patterns
  const competitorQueries = [
    ...queries,
    `"${companyName}" competitors alternatives`,
  ].slice(0, 4);

  // Search & scrape across all queries
  const allPages: ScrapedPage[] = targetPage ? [targetPage] : [];
  const seenUrls = new Set<string>(targetPage ? [targetPage.url] : []);

  for (const query of competitorQueries) {
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

  if (allPages.length <= 1) {
    throw new Error("Could not find enough competitor data to analyze");
  }

  // Synthesize
  const { brief, usage: synthUsage } = await synthesizeCompetitive(allPages, {
    title: companyName,
    description: leadContext.description,
    targetUrl: leadContext.targetUrl,
    targetContent,
  });

  return {
    brief,
    pages: allPages,
    usage: mergeUsage(queryUsage, synthUsage),
  };
}
