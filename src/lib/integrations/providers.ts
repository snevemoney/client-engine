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

/** Phase 1 providers — Meta, Upwork, GA4, Stripe, Google Ads, LinkedIn, YouTube, CRM */
export const INTEGRATION_PROVIDERS: IntegrationProvider[] = [
  { key: "meta", name: "Meta", usedBy: "Ads monitor, Pixel/CAPI lead tracking", hasRealTest: true },
  { key: "upwork", name: "Upwork", usedBy: "Lead research ingestion", hasRealTest: false },
  { key: "ga4", name: "Google Analytics (GA4)", usedBy: "Site traffic, funnel visibility", hasRealTest: false },
  { key: "stripe", name: "Stripe", usedBy: "Payments, results tracking", hasRealTest: false },
  { key: "google-ads", name: "Google Ads", usedBy: "Ad spend, conversions visibility", hasRealTest: false },
  { key: "linkedin", name: "LinkedIn", usedBy: "Research, posting, lead signals", hasRealTest: false },
  { key: "youtube", name: "YouTube", usedBy: "Transcripts, learning ingest", hasRealTest: false },
  { key: "crm", name: "CRM", usedBy: "Lead sync (HubSpot, Pipedrive, etc.)", hasRealTest: false },
];
