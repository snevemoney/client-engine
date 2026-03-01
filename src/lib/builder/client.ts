/**
 * API client for the Website Builder service.
 *
 * The builder is a separate service that creates, generates content for,
 * and deploys client websites. Client Engine orchestrates the build
 * through this client — triggering site creation from delivery projects,
 * checking build progress, and deploying when ready.
 *
 * Requires BUILDER_API_URL and BUILDER_API_KEY env vars.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BuilderIndustryPreset =
  | "health_coaching"
  | "life_coaching"
  | "business_coaching"
  | "fitness"
  | "consulting"
  | "freelance"
  | "agency"
  | "custom";

export type BuilderSiteStatus =
  | "creating"
  | "content_generating"
  | "draft"
  | "review"
  | "deploying"
  | "live"
  | "error";

export type CreateSiteInput = {
  clientName: string;
  industry: BuilderIndustryPreset;
  scope: string[];           // e.g. ["homepage", "about", "services", "booking", "testimonials"]
  brandColors?: string[];
  contentHints?: string;      // prospect data, bio, niche — feeds AI content generation
  deliveryProjectId?: string; // back-reference to Client Engine
};

export type BuilderSite = {
  siteId: string;
  status: BuilderSiteStatus;
  previewUrl: string;
  liveUrl?: string;
  pages: string[];
  createdAt: string;
  updatedAt: string;
  quality?: {
    score: number;
    label: string;
    issues: string[];
    attempts: number;
  };
};

export type GenerateContentInput = {
  sections: string[];
  clientInfo: {
    name: string;
    niche?: string;
    services?: string[];
    bio?: string;
    tone?: string;
    // Extended context from pipeline intelligence (shared brain)
    feltProblem?: string;
    reframedOffer?: string;
    blueOceanAngle?: string;
    languageMap?: string;
    scoreVerdict?: string;
    scoreReason?: string;
    enrichmentSummary?: string;
    trustSensitivity?: string;
    safeStartingPoint?: string;
  };
};

export type SiteDeployResult = {
  siteId: string;
  liveUrl: string;
  status: "live";
};

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

function getConfig() {
  const baseUrl = process.env.BUILDER_API_URL;
  const apiKey = process.env.BUILDER_API_KEY;

  if (!baseUrl) throw new Error("BUILDER_API_URL is not configured");
  if (!apiKey) throw new Error("BUILDER_API_KEY is not configured");

  return { baseUrl: baseUrl.replace(/\/$/, ""), apiKey };
}

type BuilderFetchOptions = RequestInit & { timeoutMs?: number };

async function builderFetch<T>(
  path: string,
  options: BuilderFetchOptions = {},
): Promise<T> {
  const { baseUrl, apiKey } = getConfig();
  const url = `${baseUrl}${path}`;
  const { timeoutMs, ...fetchOpts } = options;

  const res = await fetch(url, {
    ...fetchOpts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...((fetchOpts.headers as Record<string, string>) ?? {}),
    },
    signal: fetchOpts.signal ?? AbortSignal.timeout(timeoutMs ?? 30_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Builder API ${fetchOpts.method ?? "GET"} ${path} → ${res.status}: ${text || res.statusText}`,
    );
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Create a new site from an industry preset. Returns the site ID + preview URL. */
export async function createSite(input: CreateSiteInput): Promise<BuilderSite> {
  return builderFetch<BuilderSite>("/api/sites", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Trigger AI content generation for specific sections of a site. */
export async function generateContent(
  siteId: string,
  input: GenerateContentInput,
): Promise<BuilderSite> {
  return builderFetch<BuilderSite>(`/api/sites/${siteId}/generate`, {
    method: "POST",
    body: JSON.stringify(input),
    timeoutMs: 120_000, // AI generation can take a while
  });
}

/** Get current status and metadata for a site. */
export async function getSiteStatus(siteId: string): Promise<BuilderSite> {
  return builderFetch<BuilderSite>(`/api/sites/${siteId}`);
}

/** Deploy a site to production with an optional custom domain. */
export async function deploySite(
  siteId: string,
  domain?: string,
): Promise<SiteDeployResult> {
  return builderFetch<SiteDeployResult>(`/api/sites/${siteId}/deploy`, {
    method: "POST",
    body: JSON.stringify({ domain }),
  });
}

// ---------------------------------------------------------------------------
// Section editing + feedback
// ---------------------------------------------------------------------------

export type SiteSection = { type: string; props: Record<string, unknown> };

export type SiteWithSections = BuilderSite & {
  clientName: string;
  industry: string;
  sections: SiteSection[];
  contentHints: string | null;
};

export type SiteFeedback = {
  siteId: string;
  health: { score: number; label: string; sectionCount: number; issueCount: number };
  sectionScores: { type: string; score: number; issues: string[] }[];
  missingSections: { type: string; reason: string; defaultProps: Record<string, unknown> }[];
  suggestions: string[];
};

/** Get site with full section data for editing. */
export async function getSiteWithSections(siteId: string): Promise<SiteWithSections> {
  return builderFetch<SiteWithSections>(`/api/sites/${siteId}`);
}

/** Update site sections. */
export async function updateSiteSections(
  siteId: string,
  sections: SiteSection[],
): Promise<SiteWithSections> {
  return builderFetch<SiteWithSections>(`/api/sites/${siteId}`, {
    method: "PATCH",
    body: JSON.stringify({ sections }),
  });
}

/** Get AI feedback on site quality and missing sections. */
export async function getSiteFeedback(siteId: string): Promise<SiteFeedback> {
  return builderFetch<SiteFeedback>(`/api/sites/${siteId}/feedback`);
}

// ---------------------------------------------------------------------------
// Support requests + activity events
// ---------------------------------------------------------------------------

export type BuilderSupportRequest = {
  id: string;
  siteId: string;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved";
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export type BuilderSiteEvent = {
  id: string;
  actor: string;
  action: string;
  detail: string | null;
  createdAt: string;
};

/** Get support requests for a site, optionally filtered by status. */
export async function getSupportRequests(
  siteId: string,
  status?: string,
): Promise<BuilderSupportRequest[]> {
  const query = status ? `?status=${status}` : "";
  return builderFetch<BuilderSupportRequest[]>(`/api/sites/${siteId}/support${query}`);
}

/** Update a support request (resolve, add resolution note). Agency only. */
export async function updateSupportRequest(
  siteId: string,
  requestId: string,
  data: { status?: string; resolution?: string },
): Promise<BuilderSupportRequest> {
  return builderFetch<BuilderSupportRequest>(`/api/sites/${siteId}/support/${requestId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/** Get recent activity events for a site. */
export async function getSiteEvents(siteId: string): Promise<BuilderSiteEvent[]> {
  return builderFetch<BuilderSiteEvent[]>(`/api/sites/${siteId}/events`);
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

/** Check if the builder service is reachable. */
export async function builderHealthCheck(): Promise<boolean> {
  try {
    const { baseUrl, apiKey } = getConfig();
    const res = await fetch(`${baseUrl}/api/health`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
