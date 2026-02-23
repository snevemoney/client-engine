/**
 * Integration provider definitions (used by Settings Integrations section).
 * Data-driven; easy to add more providers.
 */

export type IntegrationStatus = "not_connected" | "connected" | "error" | "disabled";

export type IntegrationProvider = {
  key: string;
  name: string;
  usedBy: string;
  /** Whether real test is implemented (Meta has token check) */
  hasRealTest: boolean;
};

export const INTEGRATION_PROVIDERS: IntegrationProvider[] = [
  { key: "meta", name: "Meta", usedBy: "Ads monitor, Pixel/CAPI lead tracking", hasRealTest: true },
  { key: "google-ads", name: "Google Ads", usedBy: "Ad spend, conversions visibility", hasRealTest: false },
  { key: "linkedin", name: "LinkedIn", usedBy: "Research, posting, lead signals", hasRealTest: false },
  { key: "upwork", name: "Upwork", usedBy: "Lead research ingestion", hasRealTest: false },
  { key: "fiverr", name: "Fiverr", usedBy: "Lead research", hasRealTest: false },
  { key: "x", name: "X (Twitter)", usedBy: "Research, posting", hasRealTest: false },
  { key: "reddit", name: "Reddit", usedBy: "Research, community signals", hasRealTest: false },
  { key: "youtube", name: "YouTube", usedBy: "Transcripts, learning ingest", hasRealTest: false },
  { key: "ga4", name: "Google Analytics (GA4)", usedBy: "Site traffic/funnel visibility", hasRealTest: false },
  { key: "search-console", name: "Search Console", usedBy: "Search performance, queries", hasRealTest: false },
  { key: "stripe", name: "Stripe", usedBy: "Payments/results tracking", hasRealTest: false },
  { key: "calendly", name: "Calendly", usedBy: "Call booking, follow-up sync", hasRealTest: false },
  { key: "crm", name: "CRM", usedBy: "Lead sync (HubSpot, Pipedrive, etc.)", hasRealTest: false },
];
