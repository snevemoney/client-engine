/**
 * Research Engine R1: source adapter contract and opportunity shape.
 * Adapters discover opportunities from RSS/APIs/feeds without scraping at scale.
 */

export type RawOpportunity = {
  title: string;
  description: string;
  sourceUrl: string;
  contactPath?: string | null;
  tags?: string[];
  /** Adapter name for provenance */
  adapter: string;
  /** 0–1 confidence for filtering */
  confidence?: number;
};

export type ResearchSourceAdapter = {
  name: string;
  discover: (opts?: { limit?: number }) => Promise<RawOpportunity[]>;
};

export type ResearchRunReport = {
  ok: boolean;
  at: string;
  discovered: number;
  filtered: number;
  skippedDedupe: number;
  created: number;
  errors: string[];
  leadIds?: string[];
};
