/**
 * Provider registry — single source of truth for integration providers.
 * Used by API/UI. Keys match existing DB (meta, rss, crm, etc.) for compatibility.
 */

export type IntegrationCategory =
  | "research"
  | "outreach"
  | "content"
  | "visibility"
  | "ops"
  | "delivery"
  | "analytics";

export type IntegrationPurpose =
  | "prospecting"
  | "monitoring"
  | "scheduling"
  | "crm"
  | "analytics"
  | "content"
  | "ops"
  | "enrichment"
  | "visibility";

export type IntegrationMode = "off" | "mock" | "manual" | "live";

export type ProspectingCapability = {
  /** Human description of what this source finds */
  finds: string;
  /** Keywords/client types this source is best at finding */
  bestFor: string[];
  /** If true, location in criteria boosts this source's relevance */
  locationAware: boolean;
};

export type ProviderDef = {
  provider: string;
  displayName: string;
  category: IntegrationCategory;
  /** What this integration is used for — determines if it appears in prospect search, etc. */
  purposes: IntegrationPurpose[];
  /** Prospecting-specific metadata for smart routing */
  prospecting?: ProspectingCapability;
  prodOnly: boolean;
  defaultMode: IntegrationMode;
  helpText?: string;
  supportsLive: boolean;
  supportsMock: boolean;
  supportsManual: boolean;
  sortOrder: number;
  hasRealTest?: boolean;
  supportsQueryParams?: boolean;
  /** Direct link to the platform's dashboard or API key page */
  platformUrl?: string;
  /** Where to generate / manage API keys specifically */
  apiKeyUrl?: string;
};

/** All providers in the registry. Keys must match IntegrationConnection.provider. */
export const PROVIDER_REGISTRY: ProviderDef[] = [
  // ── Monitoring / Analytics ──
  { provider: "meta", displayName: "Meta Ads", category: "analytics", purposes: ["monitoring", "analytics"], prodOnly: true, defaultMode: "off", helpText: "Only works in live mode when deployed.", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 10, hasRealTest: true, platformUrl: "https://business.facebook.com", apiKeyUrl: "https://developers.facebook.com/tools/explorer/" },
  { provider: "ga4", displayName: "Google Analytics 4", category: "analytics", purposes: ["analytics"], prodOnly: true, defaultMode: "off", helpText: "Only works in live mode when deployed.", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 80, platformUrl: "https://analytics.google.com", apiKeyUrl: "https://console.cloud.google.com/apis/credentials" },
  { provider: "google-ads", displayName: "Google Ads", category: "analytics", purposes: ["analytics", "monitoring"], prodOnly: true, defaultMode: "off", helpText: "Only works in live mode when deployed.", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 150, platformUrl: "https://ads.google.com", apiKeyUrl: "https://console.cloud.google.com/apis/credentials" },

  // ── Research / Signals ──
  { provider: "rss", displayName: "RSS / News", category: "research", purposes: ["monitoring"], prodOnly: false, defaultMode: "mock", helpText: "Add your news feed links here. You can add filters in the settings.", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 30, supportsQueryParams: true },
  { provider: "upwork", displayName: "Upwork", category: "research", purposes: ["prospecting", "monitoring"], prospecting: { finds: "Job posts from clients actively hiring", bestFor: ["freelancers", "agencies", "consultants", "developers", "designers", "writers", "marketers", "coaches", "anyone hiring"], locationAware: true }, prodOnly: false, defaultMode: "manual", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 20, platformUrl: "https://www.upwork.com/nx/find-work/best-matches" },

  // ── Prospecting (dedicated) ──
  { provider: "google_places", displayName: "Google Places", category: "research", purposes: ["prospecting"], prospecting: { finds: "Local businesses by type and location", bestFor: ["coaches", "gyms", "restaurants", "salons", "clinics", "therapists", "dentists", "lawyers", "accountants", "real estate agents", "local businesses", "brick-and-mortar", "service providers"], locationAware: true }, prodOnly: false, defaultMode: "off", helpText: "Find local businesses. Requires Google Cloud API key with Places API.", supportsLive: true, supportsMock: true, supportsManual: false, sortOrder: 15, platformUrl: "https://console.cloud.google.com/google/maps-apis", apiKeyUrl: "https://console.cloud.google.com/apis/credentials" },
  { provider: "serpapi", displayName: "Web Search (SerpAPI)", category: "research", purposes: ["prospecting"], prospecting: { finds: "Businesses and people via Google search results", bestFor: ["any", "coaches", "agencies", "startups", "SaaS", "ecommerce", "freelancers", "consultants", "local businesses", "creators", "influencers"], locationAware: true }, prodOnly: false, defaultMode: "off", helpText: "Search Google programmatically. Free tier: 100 searches/month.", supportsLive: true, supportsMock: true, supportsManual: false, sortOrder: 16, platformUrl: "https://serpapi.com/dashboard", apiKeyUrl: "https://serpapi.com/manage-api-key" },
  { provider: "apollo", displayName: "Apollo.io", category: "research", purposes: ["prospecting", "enrichment"], prospecting: { finds: "Professionals and companies with contact info", bestFor: ["B2B", "SaaS founders", "executives", "decision makers", "startups", "agencies", "consultants", "coaches", "anyone by job title"], locationAware: true }, prodOnly: false, defaultMode: "off", helpText: "Sales intelligence platform. Free tier: 10k credits/month.", supportsLive: true, supportsMock: true, supportsManual: false, sortOrder: 17, platformUrl: "https://app.apollo.io", apiKeyUrl: "https://app.apollo.io/settings/integrations/api-keys" },
  { provider: "hunter", displayName: "Hunter.io", category: "research", purposes: ["enrichment", "prospecting"], prospecting: { finds: "Email addresses for any domain", bestFor: ["email lookup", "contact enrichment", "domain search", "outreach prep"], locationAware: false }, prodOnly: false, defaultMode: "off", helpText: "Find professional emails by domain. Free: 25 searches/month.", supportsLive: true, supportsMock: true, supportsManual: false, sortOrder: 18, platformUrl: "https://hunter.io/dashboard", apiKeyUrl: "https://hunter.io/api-keys" },
  { provider: "yelp", displayName: "Yelp", category: "research", purposes: ["prospecting"], prospecting: { finds: "Local businesses with reviews and ratings", bestFor: ["restaurants", "salons", "gyms", "coaches", "therapists", "spas", "local businesses", "service providers", "home services"], locationAware: true }, prodOnly: false, defaultMode: "off", helpText: "Search local businesses. Free tier: 5k API calls/day.", supportsLive: true, supportsMock: true, supportsManual: false, sortOrder: 19, platformUrl: "https://www.yelp.com", apiKeyUrl: "https://www.yelp.com/developers/v3/manage_app" },

  // ── Outreach ──
  { provider: "linkedin", displayName: "LinkedIn", category: "outreach", purposes: ["prospecting", "visibility"], prospecting: { finds: "Professionals and companies", bestFor: ["B2B", "founders", "executives", "consultants", "coaches", "agencies"], locationAware: true }, prodOnly: true, defaultMode: "manual", helpText: "Only works in live mode when deployed.", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 40, platformUrl: "https://www.linkedin.com/feed/", apiKeyUrl: "https://www.linkedin.com/developers/apps" },

  // ── CRM / Delivery ──
  { provider: "crm", displayName: "CRM (Internal)", category: "delivery", purposes: ["crm"], prodOnly: false, defaultMode: "manual", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 50 },
  { provider: "hubspot", displayName: "HubSpot", category: "delivery", purposes: ["crm"], prodOnly: false, defaultMode: "manual", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 52, platformUrl: "https://app.hubspot.com", apiKeyUrl: "https://app.hubspot.com/settings/private-apps" },
  { provider: "pipedrive", displayName: "Pipedrive", category: "delivery", purposes: ["crm"], prodOnly: false, defaultMode: "manual", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 54, platformUrl: "https://app.pipedrive.com", apiKeyUrl: "https://app.pipedrive.com/settings/api" },
  { provider: "stripe", displayName: "Stripe", category: "delivery", purposes: ["crm"], prodOnly: false, defaultMode: "off", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 140, platformUrl: "https://dashboard.stripe.com", apiKeyUrl: "https://dashboard.stripe.com/apikeys" },

  // ── Scheduling ──
  { provider: "calendly", displayName: "Calendly", category: "delivery", purposes: ["scheduling"], prodOnly: false, defaultMode: "manual", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 60, platformUrl: "https://calendly.com/event_types/user/me", apiKeyUrl: "https://calendly.com/integrations/api_webhooks" },
  { provider: "calcom", displayName: "Cal.com", category: "delivery", purposes: ["scheduling"], prodOnly: false, defaultMode: "manual", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 62, platformUrl: "https://app.cal.com", apiKeyUrl: "https://app.cal.com/settings/developer/api-keys" },

  // ── Content ──
  { provider: "loom", displayName: "Loom", category: "content", purposes: ["content"], prodOnly: false, defaultMode: "manual", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 70, platformUrl: "https://www.loom.com/looms/videos", apiKeyUrl: "https://www.loom.com/developer-portal" },
  { provider: "youtube", displayName: "YouTube", category: "content", purposes: ["content", "prospecting"], prospecting: { finds: "Creators and channels by topic", bestFor: ["creators", "coaches", "influencers", "educators", "content creators", "fitness", "wellness"], locationAware: false }, prodOnly: false, defaultMode: "off", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 130, platformUrl: "https://studio.youtube.com", apiKeyUrl: "https://console.cloud.google.com/apis/credentials" },

  // ── Visibility ──
  { provider: "search_console", displayName: "Google Search Console", category: "visibility", purposes: ["analytics", "visibility"], prodOnly: true, defaultMode: "manual", helpText: "Only works in live mode when deployed.", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 90, platformUrl: "https://search.google.com/search-console", apiKeyUrl: "https://console.cloud.google.com/apis/credentials" },
  { provider: "instagram", displayName: "Instagram", category: "visibility", purposes: ["visibility", "content"], prodOnly: false, defaultMode: "manual", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 100, platformUrl: "https://www.instagram.com", apiKeyUrl: "https://developers.facebook.com/apps/" },
  { provider: "x", displayName: "X (Twitter)", category: "visibility", purposes: ["visibility", "content"], prodOnly: false, defaultMode: "manual", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 110, platformUrl: "https://x.com", apiKeyUrl: "https://developer.x.com/en/portal/dashboard" },
  { provider: "google_business_profile", displayName: "Google Business Profile", category: "visibility", purposes: ["visibility"], prodOnly: true, defaultMode: "manual", helpText: "Only works in live mode when deployed.", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 120, platformUrl: "https://business.google.com", apiKeyUrl: "https://console.cloud.google.com/apis/credentials" },

  // ── Ops ──
  { provider: "github", displayName: "GitHub", category: "ops", purposes: ["ops"], prodOnly: false, defaultMode: "manual", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 160, platformUrl: "https://github.com", apiKeyUrl: "https://github.com/settings/tokens" },
];

/** Get all providers that serve a specific purpose */
export function getProvidersForPurpose(purpose: IntegrationPurpose): ProviderDef[] {
  return PROVIDER_REGISTRY.filter((p) => p.purposes.includes(purpose));
}

/** Get all prospecting-capable providers */
export function getProspectingProviders(): ProviderDef[] {
  return PROVIDER_REGISTRY.filter((p) => p.prospecting != null);
}

const byProvider = new Map<string, ProviderDef>();
for (const p of PROVIDER_REGISTRY) {
  byProvider.set(p.provider, p);
}

/** Spec keys -> canonical DB keys. Use so meta_ads, rss_news etc. work with existing rows. */
const PROVIDER_ALIASES: Record<string, string> = {
  meta_ads: "meta",
  rss_news: "rss",
  internal_crm: "crm",
  crm_internal: "crm",
  x_twitter: "x",
  google_search_console: "search_console",
};

/** Resolve provider key to canonical form (for DB and registry lookup). */
export function resolveProviderKey(provider: string): string {
  return PROVIDER_ALIASES[provider] ?? provider;
}

export function getProviderDef(provider: string): ProviderDef | undefined {
  const canonical = resolveProviderKey(provider);
  return byProvider.get(canonical);
}

/** All registered provider keys */
export function getProviderKeys(): string[] {
  return PROVIDER_REGISTRY.map((p) => p.provider);
}
