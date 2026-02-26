/**
 * Integration provider definitions (used by Settings Integrations section).
 * Derived from providerRegistry — single source of truth.
 */

import { PROVIDER_REGISTRY } from "./providerRegistry";
import type { IntegrationPurpose } from "./providerRegistry";

export type IntegrationStatus = "not_connected" | "connected" | "error" | "disabled";

export type IntegrationMode = "off" | "mock" | "manual" | "live";

export type IntegrationCategory =
  | "research"
  | "outreach"
  | "content"
  | "visibility"
  | "ops"
  | "delivery"
  | "analytics";

export type IntegrationProvider = {
  key: string;
  name: string;
  usedBy: string;
  hasRealTest: boolean;
  category: IntegrationCategory;
  purposes: IntegrationPurpose[];
  prodOnly: boolean;
  sortOrder: number;
  helpText?: string;
  supportsQueryParams?: boolean;
};

/** Derived from providerRegistry for backward compat. */
export const INTEGRATION_PROVIDERS: IntegrationProvider[] = PROVIDER_REGISTRY.map((p) => ({
  key: p.provider,
  name: p.displayName,
  usedBy: "",
  hasRealTest: p.hasRealTest ?? false,
  category: p.category,
  purposes: p.purposes,
  prodOnly: p.prodOnly,
  sortOrder: p.sortOrder,
  helpText: p.helpText,
  supportsQueryParams: p.supportsQueryParams ?? false,
}));
