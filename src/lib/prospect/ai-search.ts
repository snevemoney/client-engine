import { z } from "zod";
import { chat } from "@/lib/llm";
import { safeParseJSON } from "@/lib/llm/safe-parse-json";
import { searchWeb } from "@/lib/web-research/scraper/search";
import { scrapeUrl } from "@/lib/web-research/scraper";
import type { ScrapedPage } from "@/lib/web-research/types";
import type { ProspectResult } from "./types";

const LLM_OPTS = { model: "gpt-4o-mini", temperature: 0.2, max_tokens: 1000 } as const;
const QUALIFY_LLM_OPTS = { model: "gpt-4o-mini", temperature: 0.3, max_tokens: 4000 } as const;
const BRIEF_LLM_OPTS = { model: "gpt-4o-mini", temperature: 0.3, max_tokens: 4000 } as const;

// ── Types ──

const PLATFORMS = [
  "facebook", "x", "linkedin", "instagram",
  "upwork", "google", "youtube", "yelp",
] as const;

type Platform = (typeof PLATFORMS)[number];

const optionalString = z.string().nullable().optional().transform((v) => v ?? undefined);

const ParsedQuerySchema = z.object({
  clientType: z.string(),
  industry: optionalString,
  keywords: z.array(z.string()).default([]),
  platforms: z.array(z.enum(PLATFORMS)).default(["google"]),
  count: z.number().min(1).max(100).default(10),
  location: optionalString,
});

export type ParsedProspectQuery = z.infer<typeof ParsedQuerySchema>;

type ProspectQualification = {
  url: string;
  name: string;
  handle?: string;
  niche: string;
  followers?: string;
  currentWebPresence: string;
  bioLinkType?: string;
  hasWebsite: boolean;
  websiteUrl?: string;
  bookingFlow: string;
  clientIntake: string;
  socialProof: string;
  offerClarity: string;
  services: string[];
  missingInfrastructure: string[];
  salesOpportunity: string;
  businessSummary: string;
  contactInfo?: string;
  opportunityScore: number;
  tier: string;
  qualificationReason: string;
};

export type AiProspectReport = {
  ok: boolean;
  parsed: ParsedProspectQuery;
  results: ProspectResult[];
  brief: string;
  followUps: string[];
  platformBreakdown: { platform: string; count: number }[];
  durationMs: number;
  errors: string[];
};

// ── Site-specific search prefixes per platform ──

const SITE_PREFIX: Record<Platform, string> = {
  facebook: "site:facebook.com",
  x: "site:x.com OR site:twitter.com",
  linkedin: "site:linkedin.com/in",
  instagram: "site:instagram.com",
  upwork: "site:upwork.com/freelancers",
  google: "",
  youtube: "youtube.com",
  yelp: "yelp.com",
};

// ── NL Query Parser ──

export async function parseProspectQuery(query: string): Promise<ParsedProspectQuery> {
  const { content: raw } = await chat(
    [
      {
        role: "system",
        content: `You parse natural-language prospect search queries into structured JSON. Return ONLY valid JSON.`,
      },
      {
        role: "user",
        content: `Parse this prospect search query:

"${query}"

Return JSON:
{
  "clientType": "the type of prospect (e.g. coaches, restaurants, SaaS founders)",
  "industry": "industry if mentioned (e.g. fitness, healthcare)",
  "keywords": ["qualifying keywords like 'active', 'weak infrastructure', 'no website'"],
  "platforms": ["which platforms to search — pick from: facebook, x, linkedin, instagram, upwork, google, youtube, yelp"],
  "count": 10,
  "location": "location if mentioned"
}

Rules:
- If no platforms are mentioned, default to ["google"]
- If user says "all platforms" or "everywhere", include all 8 platforms
- If user says a number like "find 20", set count to that number
- "twitter" maps to "x"
- Extract qualifying descriptors as keywords (e.g. "active", "with weak infrastructure", "no website")
- clientType should be the core noun (e.g. "coaches" not "active coaches with weak infrastructure")
- Return ONLY valid JSON.`,
      },
    ],
    LLM_OPTS,
  );

  return ParsedQuerySchema.parse(safeParseJSON(raw));
}

// ── Site-specific search ──

function makeId(): string {
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildSearchQuery(platform: Platform, parsed: ParsedProspectQuery): string {
  const prefix = SITE_PREFIX[platform];
  const parts: string[] = [];
  if (prefix) parts.push(prefix);
  parts.push(parsed.clientType);
  if (parsed.keywords.length > 0) {
    parts.push(parsed.keywords.join(" "));
  }
  if (parsed.industry) {
    parts.push(parsed.industry);
  }
  if (parsed.location) {
    parts.push(parsed.location);
  }
  return parts.join(" ");
}

async function searchPlatform(
  platform: Platform,
  parsed: ParsedProspectQuery,
): Promise<ProspectResult[]> {
  const query = buildSearchQuery(platform, parsed);
  const results = await searchWeb(query, { limit: Math.min(parsed.count, 15) });

  return results.map((r, i) => ({
    id: makeId(),
    source: platform,
    title: r.title,
    description: r.snippet,
    url: r.url,
    tags: [platform],
    confidence: Math.max(0.3, 0.7 - i * 0.03),
    meta: { searchRank: r.rank },
  }));
}

// ── Page scraping with bio-link following ──

const SCRAPE_CONCURRENCY = 3;

/** Extract external URLs from scraped page content that might be bio links. */
function extractBioLinks(content: string, profileDomain: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"')\]]+/g;
  const matches = content.match(urlRegex) || [];
  const seen = new Set<string>();
  const bioLinks: string[] = [];

  // Known bio-link / link-in-bio domains
  const BIO_LINK_DOMAINS = [
    "linktr.ee", "linktree.com", "beacons.ai", "stan.store",
    "bio.link", "lnk.bio", "campsite.bio", "tap.bio",
    "linkin.bio", "milkshake.app", "carrd.co", "about.me",
    "calendly.com", "acuityscheduling.com", "gethealthie.com",
  ];

  for (const url of matches) {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, "");
      // Skip the profile's own domain (e.g. instagram.com links on an instagram page)
      if (host === profileDomain || host === `www.${profileDomain}`) continue;
      // Skip common non-bio URLs
      if (host.includes("cdn") || host.includes("asset") || host.includes("static")) continue;
      if (url.match(/\.(jpg|png|gif|svg|css|js|ico|woff)/i)) continue;

      const normalized = `${u.protocol}//${u.host}${u.pathname}`;
      if (seen.has(normalized)) continue;
      seen.add(normalized);

      // Prioritize known bio-link domains
      const isBioLink = BIO_LINK_DOMAINS.some((d) => host.includes(d));
      if (isBioLink) {
        bioLinks.unshift(url); // Priority
      } else if (!host.includes("facebook.com") && !host.includes("instagram.com") &&
                 !host.includes("twitter.com") && !host.includes("x.com") &&
                 !host.includes("youtube.com") && !host.includes("google.com")) {
        bioLinks.push(url);
      }
    } catch {
      // Skip invalid URLs
    }
  }

  return bioLinks.slice(0, 3); // Max 3 bio links per profile
}

async function scrapeProspectPages(
  results: ProspectResult[],
  errors: string[],
): Promise<{ profilePages: Map<string, ScrapedPage>; bioLinkPages: Map<string, ScrapedPage> }> {
  const profilePages = new Map<string, ScrapedPage>();
  const bioLinkPages = new Map<string, ScrapedPage>();
  const urlsToScrape = results.filter((r) => r.url).map((r) => r.url!);

  // Phase 1: Scrape profile pages
  for (let i = 0; i < urlsToScrape.length; i += SCRAPE_CONCURRENCY) {
    const batch = urlsToScrape.slice(i, i + SCRAPE_CONCURRENCY);

    const batchResults = await Promise.allSettled(
      batch.map(async (url) => {
        const page = await scrapeUrl(url);
        return { url, page };
      }),
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled" && result.value.page) {
        profilePages.set(result.value.url, result.value.page);
      } else if (result.status === "rejected") {
        errors.push(`Scrape failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
      }
    }

    if (i + SCRAPE_CONCURRENCY < urlsToScrape.length) {
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));
    }
  }

  // Phase 2: Follow bio links found in profile pages
  const bioLinksToScrape: { profileUrl: string; bioUrl: string }[] = [];
  for (const [profileUrl, page] of profilePages) {
    const domain = page.domain || new URL(profileUrl).hostname.replace(/^www\./, "");
    const links = extractBioLinks(page.content, domain);
    for (const bioUrl of links) {
      bioLinksToScrape.push({ profileUrl, bioUrl });
    }
  }

  // Scrape bio links (limit total to avoid taking too long)
  const maxBioScrapes = Math.min(bioLinksToScrape.length, 15);
  for (let i = 0; i < maxBioScrapes; i += SCRAPE_CONCURRENCY) {
    const batch = bioLinksToScrape.slice(i, i + SCRAPE_CONCURRENCY);

    const batchResults = await Promise.allSettled(
      batch.map(async ({ profileUrl, bioUrl }) => {
        const page = await scrapeUrl(bioUrl);
        return { profileUrl, bioUrl, page };
      }),
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled" && result.value.page) {
        // Key by profile URL so we can associate bio-link content with the prospect
        const existing = bioLinkPages.get(result.value.profileUrl);
        if (!existing) {
          bioLinkPages.set(result.value.profileUrl, result.value.page);
        }
      }
    }

    if (i + SCRAPE_CONCURRENCY < maxBioScrapes) {
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));
    }
  }

  return { profilePages, bioLinkPages };
}

// ── LLM prospect qualification ──

async function qualifyProspects(
  results: ProspectResult[],
  profilePages: Map<string, ScrapedPage>,
  bioLinkPages: Map<string, ScrapedPage>,
  query: string,
  parsed: ParsedProspectQuery,
): Promise<Map<string, ProspectQualification>> {
  // Build sources block — include both profile page and bio-link page content
  const sourcesForLLM: { url: string; title: string; profileContent: string; bioLinkContent?: string; bioLinkUrl?: string }[] = [];

  for (const r of results) {
    if (!r.url) continue;
    const profile = profilePages.get(r.url);
    const bioLink = bioLinkPages.get(r.url);

    // Include even if we only have search snippet data (from title/description)
    sourcesForLLM.push({
      url: r.url,
      title: profile?.title || r.title,
      profileContent: profile ? profile.content.slice(0, 2500) : (r.description || r.title),
      bioLinkContent: bioLink ? bioLink.content.slice(0, 2000) : undefined,
      bioLinkUrl: bioLink?.url,
    });
  }

  if (sourcesForLLM.length === 0) {
    return new Map();
  }

  const sourcesBlock = sourcesForLLM
    .map((s, i) => {
      let block = `--- PROSPECT ${i + 1} ---\nProfile URL: ${s.url}\nTitle: ${s.title}\n\nProfile Content:\n${s.profileContent}\n`;
      if (s.bioLinkContent) {
        block += `\nBio Link (${s.bioLinkUrl}):\n${s.bioLinkContent}\n`;
      }
      return block;
    })
    .join("\n");

  const { content: raw } = await chat(
    [
      {
        role: "system",
        content: `You are a prospect qualification analyst. You analyze profile pages and their bio links to produce detailed prospect audits. You extract names, handles, niches, follower counts, web presence status, booking flow quality, and opportunity scores. Return ONLY valid JSON.`,
      },
      {
        role: "user",
        content: `The user searched: "${query}"
Looking for: ${parsed.clientType}${parsed.keywords.length > 0 ? ` (criteria: ${parsed.keywords.join(", ")})` : ""}

Analyze each prospect and produce a detailed qualification:

${sourcesBlock}

Return a JSON array. For EACH prospect:
[
  {
    "url": "profile URL",
    "name": "person/business name extracted from the page",
    "handle": "@handle if found",
    "niche": "their specific niche (e.g. 'Life Coach', 'Business Coach', 'Fitness Trainer')",
    "followers": "follower count if visible (e.g. '16.9k', '3,302')",
    "currentWebPresence": "describe what they have: 'Linktree only', 'No website', 'Basic Wix site', 'Calendly link only', 'Professional website', etc.",
    "bioLinkType": "what type of link is in their bio: 'linktree', 'beacons', 'calendly', 'website', 'google form', 'none', etc.",
    "hasWebsite": true/false,
    "websiteUrl": "their website URL if found, or null",
    "bookingFlow": "describe the booking flow: 'None', 'Google Form', 'Calendly', 'Integrated booking', 'Broken link', 'WhatsApp only', etc.",
    "clientIntake": "describe client intake: 'None', 'Basic form', 'Intake questionnaire', etc.",
    "socialProof": "describe social proof: 'None', 'Testimonials PDF', 'Reviews highlight on IG', 'Dedicated reviews page', etc.",
    "offerClarity": "is their offer clear in 5 seconds? 'Yes - clear coaching offer', 'No - too many CTAs', 'No - looks like a directory', etc.",
    "services": ["services they offer"],
    "missingInfrastructure": ["specific things missing: 'no website', 'no booking system', 'no client portal', 'no testimonials page', 'broken bio link'"],
    "salesOpportunity": "what you could sell them: 'Website + booking + client portal', 'Website redesign + booking integration', etc.",
    "businessSummary": "2-3 sentence description of who they are, what they do, and their current situation",
    "contactInfo": "email, phone, or contact method if found, or null",
    "opportunityScore": 1-10,
    "tier": "CRITICAL_GAP | SCATTERED_LINKS | BASIC_SITE | HAS_WEBSITE",
    "qualificationReason": "1-2 sentences on why they are/aren't a good prospect"
  }
]

Tier definitions:
- CRITICAL_GAP: No website, broken links, Google Form only, zero web presence
- SCATTERED_LINKS: Linktree/Beacons with multiple scattered links, no unified flow
- BASIC_SITE: Has a basic site (Canva, simple Wix, Squarespace) but clear upgrade opportunities
- HAS_WEBSITE: Has a functional website, lower priority unless redesign needed

Opportunity score (1-10):
- 10: Broken link / no web presence + decent following + clear coaching business
- 8-9: Linktree only + active coaching business + would benefit from website+booking+portal
- 6-7: Has basic site but missing booking/portal/testimonials
- 3-5: Has decent website, minor upgrade opportunities
- 1-2: Already well set up

Rules:
- Extract real names from page content, not generic "Instagram" titles
- If a page has very little content (just a search snippet), still analyze what you can
- Be specific about what infrastructure they're missing
- The salesOpportunity should be actionable and specific
- Return ONLY valid JSON array.`,
      },
    ],
    QUALIFY_LLM_OPTS,
  );

  const qualifications = safeParseJSON<ProspectQualification[]>(raw);
  const qualMap = new Map<string, ProspectQualification>();

  if (Array.isArray(qualifications)) {
    for (const q of qualifications) {
      if (q.url) {
        qualMap.set(q.url, {
          url: q.url,
          name: q.name ?? "Unknown",
          handle: q.handle ?? undefined,
          niche: q.niche ?? "",
          followers: q.followers ?? undefined,
          currentWebPresence: q.currentWebPresence ?? "Unknown",
          bioLinkType: q.bioLinkType ?? undefined,
          hasWebsite: q.hasWebsite ?? false,
          websiteUrl: q.websiteUrl ?? undefined,
          bookingFlow: q.bookingFlow ?? "Unknown",
          clientIntake: q.clientIntake ?? "Unknown",
          socialProof: q.socialProof ?? "Unknown",
          offerClarity: q.offerClarity ?? "Unknown",
          services: Array.isArray(q.services) ? q.services : [],
          missingInfrastructure: Array.isArray(q.missingInfrastructure) ? q.missingInfrastructure : [],
          salesOpportunity: q.salesOpportunity ?? "",
          businessSummary: q.businessSummary ?? "",
          contactInfo: q.contactInfo ?? undefined,
          opportunityScore: typeof q.opportunityScore === "number" ? q.opportunityScore : 5,
          tier: q.tier ?? "BASIC_SITE",
          qualificationReason: q.qualificationReason ?? "",
        });
      }
    }
  }

  return qualMap;
}

// ── Brief compilation ──

async function compileBrief(
  query: string,
  parsed: ParsedProspectQuery,
  results: ProspectResult[],
): Promise<string> {
  // Build a compact summary of all qualified results for the brief compiler
  const prospectData = results
    .slice(0, 30)
    .map((r, i) => {
      const m = r.meta as Record<string, unknown> | undefined;
      return `${i + 1}. ${m?.name || r.title} | ${m?.handle || ""} | ${m?.niche || ""} | Followers: ${m?.followers || "?"} | Web: ${m?.currentWebPresence || "?"} | Booking: ${m?.bookingFlow || "?"} | Tier: ${m?.tier || "?"} | Score: ${m?.opportunityScore || "?"}/10 | Opportunity: ${m?.salesOpportunity || "?"}`;
    })
    .join("\n");

  const { content: brief } = await chat(
    [
      {
        role: "system",
        content: `You compile prospect research into a concise, actionable brief. Use clean formatting with tiers, tables, and practical talking points. Write in a direct, operator style.`,
      },
      {
        role: "user",
        content: `Compile a prospect brief from this research.

Original query: "${query}"
Looking for: ${parsed.clientType}

Prospect data:
${prospectData}

Write a brief that includes:
1. A prospect table organized by tier (highest opportunity first) with columns: #, Name, Handle, Niche, Followers, Current Web Presence, Sales Opportunity
2. Top prospects to prioritize (ranked by opportunity) with why they're good leads
3. Outreach talking points per prospect category (broken links, no website, scattered linktrees, big audience)
4. Key takeaways for outreach

Format rules:
- Use markdown tables and headers
- Be concise but specific — name real tools/platforms you found (Linktree, Calendly, Google Forms, etc.)
- Tier labels: CRITICAL GAP, SCATTERED LINKS, BASIC SITE, HAS WEBSITE
- Keep the brief under 2000 words
- Make it immediately actionable`,
      },
    ],
    BRIEF_LLM_OPTS,
  );

  return brief;
}

// ── Follow-up suggestions ──

async function suggestFollowUps(
  query: string,
  results: ProspectResult[],
): Promise<string[]> {
  const resultSummary = results
    .slice(0, 10)
    .map((r) => {
      const meta = r.meta as Record<string, unknown> | undefined;
      const summary = meta?.businessSummary ?? r.description?.slice(0, 80);
      return `- ${meta?.name || r.title}: ${summary}`;
    })
    .join("\n");

  const { content: raw } = await chat(
    [
      {
        role: "system",
        content: `You suggest follow-up prospect research queries. Return a JSON array of 3-4 short, actionable follow-up queries. Return ONLY valid JSON.`,
      },
      {
        role: "user",
        content: `Original query: "${query}"

Results found (sample):
${resultSummary || "No results yet"}

Suggest 3-4 follow-up research queries that would help qualify these prospects or find related opportunities. Think about:
- Service fit: could they benefit from website, webapp, booking system, client portal?
- Gaps: what infrastructure weaknesses could be identified?
- Expansion: related niches or adjacent markets

Return a JSON array of strings, e.g.:
["find which ones could benefit from website services", "check for coaches without booking systems", "find similar prospects in adjacent niches"]

Rules:
- Keep each suggestion under 15 words
- Make them directly actionable as new search queries
- Return ONLY valid JSON array.`,
      },
    ],
    LLM_OPTS,
  );

  try {
    const p = safeParseJSON<string[]>(raw);
    return Array.isArray(p) ? p.slice(0, 4) : [];
  } catch {
    return [];
  }
}

// ── Main orchestrator ──

export async function runAiProspectSearch(query: string): Promise<AiProspectReport> {
  const start = Date.now();
  const errors: string[] = [];

  // 1. Parse NL query
  let parsed: ParsedProspectQuery;
  try {
    parsed = await parseProspectQuery(query);
  } catch (err) {
    return {
      ok: false,
      parsed: { clientType: query, industry: undefined, keywords: [], platforms: ["google"], count: 10, location: undefined },
      results: [],
      brief: "",
      followUps: [],
      platformBreakdown: [],
      durationMs: Date.now() - start,
      errors: [`Failed to parse query: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  // 2. Search each platform sequentially (with delays to avoid rate limiting)
  let results: ProspectResult[] = [];
  for (let pi = 0; pi < parsed.platforms.length; pi++) {
    const platform = parsed.platforms[pi];
    try {
      const platformResults = await searchPlatform(platform, parsed);
      results.push(...platformResults);
    } catch (err) {
      errors.push(`${platform}: ${err instanceof Error ? err.message : String(err)}`);
    }
    // Delay between platform searches to avoid rate limiting
    if (pi < parsed.platforms.length - 1) {
      await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1000));
    }
  }

  // 3. Deduplicate by URL
  const seen = new Set<string>();
  results = results.filter((r) => {
    if (!r.url) return true;
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  // Trim before scraping
  if (results.length > parsed.count) {
    results = results.slice(0, parsed.count);
  }

  // 4. Scrape profiles + follow bio links
  const { profilePages, bioLinkPages } = await scrapeProspectPages(results, errors);

  // 5. Qualify prospects via LLM analysis of scraped content
  let qualifications = new Map<string, ProspectQualification>();
  try {
    qualifications = await qualifyProspects(results, profilePages, bioLinkPages, query, parsed);
  } catch (err) {
    errors.push(`Qualification failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 6. Enrich results with qualification data
  for (const r of results) {
    if (!r.url) continue;
    const page = profilePages.get(r.url);
    const qual = qualifications.get(r.url);

    r.meta = {
      ...r.meta,
      pageScraped: !!page,
      scrapedVia: page?.scrapedVia,
    };

    if (qual) {
      r.title = qual.name !== "Unknown" ? qual.name : r.title;
      r.description = qual.businessSummary || r.description;
      r.confidence = qual.opportunityScore / 10;
      r.meta = {
        ...r.meta,
        name: qual.name,
        handle: qual.handle,
        niche: qual.niche,
        followers: qual.followers,
        currentWebPresence: qual.currentWebPresence,
        bioLinkType: qual.bioLinkType,
        hasWebsite: qual.hasWebsite,
        websiteUrl: qual.websiteUrl,
        bookingFlow: qual.bookingFlow,
        clientIntake: qual.clientIntake,
        socialProof: qual.socialProof,
        offerClarity: qual.offerClarity,
        services: qual.services,
        missingInfrastructure: qual.missingInfrastructure,
        salesOpportunity: qual.salesOpportunity,
        businessSummary: qual.businessSummary,
        contactInfo: qual.contactInfo,
        opportunityScore: qual.opportunityScore,
        tier: qual.tier,
        qualificationReason: qual.qualificationReason,
      };
    }
  }

  // 7. Sort by opportunity score (highest first)
  results.sort((a, b) => b.confidence - a.confidence);

  // 8. Platform breakdown
  const breakdown = new Map<string, number>();
  for (const r of results) {
    breakdown.set(r.source, (breakdown.get(r.source) ?? 0) + 1);
  }
  const platformBreakdown = [...breakdown.entries()]
    .map(([platform, count]) => ({ platform, count }))
    .sort((a, b) => b.count - a.count);

  // 9. Compile brief + follow-ups in parallel
  let brief = "";
  let followUps: string[] = [];

  const [briefResult, followUpsResult] = await Promise.allSettled([
    compileBrief(query, parsed, results),
    suggestFollowUps(query, results),
  ]);

  if (briefResult.status === "fulfilled") {
    brief = briefResult.value;
  }
  if (followUpsResult.status === "fulfilled") {
    followUps = followUpsResult.value;
  }

  return {
    ok: true,
    parsed,
    results,
    brief,
    followUps,
    platformBreakdown,
    durationMs: Date.now() - start,
    errors,
  };
}
