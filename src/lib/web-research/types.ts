import { z } from "zod";

// ── Request Types ──

export type WebResearchMode = "deep" | "competitive" | "technical";

export type ScrapedPage = {
  url: string;
  title: string;
  /** Extracted main text content (truncated to ~5000 chars) */
  content: string;
  /** Domain name for citation */
  domain: string;
  /** Which scraping layer succeeded */
  scrapedVia: "public-fetch" | "browser" | "search-snippet";
  /** ISO timestamp */
  scrapedAt: string;
  httpStatus?: number | null;
};

export type SearchResult = {
  url: string;
  title: string;
  snippet: string;
  /** Position in search results (0-indexed) */
  rank: number;
};

// ── Output Schemas (Zod) ──

const CitationSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  domain: z.string(),
  relevance: z.enum(["high", "medium", "low"]),
});
export type Citation = z.infer<typeof CitationSchema>;

// Deep Research output
export const DeepResearchBriefSchema = z.object({
  summary: z.string().min(50),
  keyFindings: z
    .array(
      z.object({
        finding: z.string(),
        source: z.string(),
        confidence: z.enum(["high", "medium", "low"]),
      }),
    )
    .min(1),
  opportunities: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).min(1),
  citations: z.array(CitationSchema).min(1),
});
export type DeepResearchBrief = z.infer<typeof DeepResearchBriefSchema>;

// Competitive Research output
const CompetitorProfileSchema = z.object({
  name: z.string(),
  url: z.string(),
  positioning: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  pricing: z.string().optional(),
  techStack: z.array(z.string()).default([]),
});

export const CompetitiveResearchBriefSchema = z.object({
  targetCompany: z.object({
    name: z.string(),
    url: z.string(),
    description: z.string(),
    positioning: z.string(),
  }),
  competitors: z.array(CompetitorProfileSchema).min(1),
  marketGaps: z.array(z.string()),
  differentiationAngles: z.array(z.string()).min(1),
  recommendations: z.array(z.string()).min(1),
  citations: z.array(CitationSchema).min(1),
});
export type CompetitiveResearchBrief = z.infer<typeof CompetitiveResearchBriefSchema>;

// Technical Research output
export const TechnicalResearchBriefSchema = z.object({
  summary: z.string().min(50),
  bestPractices: z
    .array(
      z.object({
        practice: z.string(),
        rationale: z.string(),
        source: z.string(),
      }),
    )
    .min(1),
  architectureNotes: z.array(z.string()).default([]),
  toolComparisons: z
    .array(
      z.object({
        tool: z.string(),
        pros: z.array(z.string()),
        cons: z.array(z.string()),
        recommendation: z.string(),
      }),
    )
    .default([]),
  recommendations: z.array(z.string()).min(1),
  citations: z.array(CitationSchema).min(1),
});
export type TechnicalResearchBrief = z.infer<typeof TechnicalResearchBriefSchema>;

// ── Request Validation ──

const modeEnum = z.enum(["deep", "competitive", "technical"]);
const sharedFields = {
  targetUrl: z.string().url().optional(),
  techContext: z.string().optional(),
  maxSources: z.number().int().min(1).max(15).optional(),
};

/** Lead-attached research: stores artifact on the lead */
const LeadAttachedSchema = z.object({
  leadId: z.string().min(1),
  mode: modeEnum,
  query: z.string().optional(),
  ...sharedFields,
});

/** Standalone research: returns brief without DB storage */
const StandaloneSchema = z.object({
  query: z.string().min(1),
  mode: modeEnum,
  leadId: z.string().optional(),
  ...sharedFields,
});

export const WebResearchRequestSchema = z.union([LeadAttachedSchema, StandaloneSchema]);
export type WebResearchRequest = z.infer<typeof WebResearchRequestSchema>;

// ── Run Result ──

export type WebResearchResult = {
  ok: boolean;
  artifactId?: string;
  mode: WebResearchMode;
  sourcesScraped: number;
  totalTokensUsed: number;
  costEstimate: number;
  durationMs: number;
  errors: string[];
  /** Included for standalone mode (no leadId) */
  brief?: DeepResearchBrief | CompetitiveResearchBrief | TechnicalResearchBrief;
  /** Markdown-formatted content */
  content?: string;
};
