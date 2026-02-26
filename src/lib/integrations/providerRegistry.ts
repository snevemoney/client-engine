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

export type IntegrationMode = "off" | "mock" | "manual" | "live";

export type ProviderDef = {
  provider: string;
  displayName: string;
  category: IntegrationCategory;
  prodOnly: boolean;
  defaultMode: IntegrationMode;
  helpText?: string;
  supportsLive: boolean;
  supportsMock: boolean;
  supportsManual: boolean;
  sortOrder: number;
  /** Whether a real test (e.g. token validation) is implemented */
  hasRealTest?: boolean;
  /** Supports additionalQueryParams in configJson (e.g. RSS hl, gl) */
  supportsQueryParams?: boolean;
};

/** All providers in the registry. Keys must match IntegrationConnection.provider. */
export const PROVIDER_REGISTRY: ProviderDef[] = [
  { provider: "meta", displayName: "Meta Ads", category: "analytics", prodOnly: true, defaultMode: "off", helpText: "Only works in live mode when deployed.", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 10, hasRealTest: true },
  { provider: "upwork", displayName: "Upwork", category: "research", prodOnly: false, defaultMode: "manual", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 20 },
  { provider: "rss", displayName: "RSS / News", category: "research", prodOnly: false, defaultMode: "mock", helpText: "Add your news feed links here. You can add filters in the settings.", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 30, supportsQueryParams: true },
  { provider: "linkedin", displayName: "LinkedIn", category: "outreach", prodOnly: true, defaultMode: "manual", helpText: "Only works in live mode when deployed.", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 40 },
  { provider: "crm", displayName: "CRM (Internal / HubSpot / Pipedrive)", category: "delivery", prodOnly: false, defaultMode: "manual", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 50 },
  { provider: "hubspot", displayName: "HubSpot", category: "delivery", prodOnly: false, defaultMode: "manual", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 52 },
  { provider: "pipedrive", displayName: "Pipedrive", category: "delivery", prodOnly: false, defaultMode: "manual", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 54 },
  { provider: "calendly", displayName: "Calendly / Cal.com", category: "delivery", prodOnly: false, defaultMode: "manual", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 60 },
  { provider: "calcom", displayName: "Cal.com", category: "delivery", prodOnly: false, defaultMode: "manual", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 62 },
  { provider: "loom", displayName: "Loom", category: "content", prodOnly: false, defaultMode: "manual", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 70 },
  { provider: "ga4", displayName: "Google Analytics 4", category: "analytics", prodOnly: true, defaultMode: "off", helpText: "Only works in live mode when deployed.", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 80 },
  { provider: "search_console", displayName: "Google Search Console", category: "visibility", prodOnly: true, defaultMode: "manual", helpText: "Only works in live mode when deployed.", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 90 },
  { provider: "instagram", displayName: "Instagram", category: "visibility", prodOnly: false, defaultMode: "manual", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 100 },
  { provider: "x", displayName: "X (Twitter)", category: "visibility", prodOnly: false, defaultMode: "manual", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 110 },
  { provider: "google_business_profile", displayName: "Google Business Profile", category: "visibility", prodOnly: true, defaultMode: "manual", helpText: "Only works in live mode when deployed.", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 120 },
  { provider: "youtube", displayName: "YouTube", category: "content", prodOnly: false, defaultMode: "off", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 130 },
  { provider: "stripe", displayName: "Stripe", category: "delivery", prodOnly: false, defaultMode: "off", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 140 },
  { provider: "google-ads", displayName: "Google Ads", category: "analytics", prodOnly: true, defaultMode: "off", helpText: "Only works in live mode when deployed.", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 150 },
  { provider: "github", displayName: "GitHub", category: "ops", prodOnly: false, defaultMode: "manual", supportsLive: true, supportsMock: true, supportsManual: true, sortOrder: 160 },
];

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
