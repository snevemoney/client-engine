/**
 * Credential resolver — DB-first, env-var fallback.
 * Single source of truth for all integration secrets.
 * The Connections UI writes to DB; env vars act as initial seed / fallback.
 */

import { db } from "@/lib/db";
import { resolveProviderKey } from "./providerRegistry";

export type ProviderCredentials = {
  accessToken: string | null;
  accountId: string | null;
  pixelId: string | null;
  capiToken: string | null;
  baseUrl: string | null;
  bookingUrl: string | null;
  extra: Record<string, unknown>;
  source: "db" | "env" | "none";
};

type EnvMapping = {
  accessToken?: string;
  accountId?: string;
  pixelId?: string;
  capiToken?: string;
  baseUrl?: string;
};

/**
 * Maps each provider to the env vars it can fall back to.
 * Keys are canonical provider names (matching providerRegistry).
 */
const ENV_MAP: Record<string, EnvMapping> = {
  meta: {
    accessToken: "META_ACCESS_TOKEN",
    accountId: "META_AD_ACCOUNT_ID",
    pixelId: "META_PIXEL_ID",
    capiToken: "META_CAPI_ACCESS_TOKEN",
  },
  github: {
    accessToken: "GITHUB_TOKEN",
  },
  stripe: {
    accessToken: "STRIPE_SECRET_KEY",
  },
  hubspot: {
    accessToken: "HUBSPOT_ACCESS_TOKEN",
  },
  pipedrive: {
    accessToken: "PIPEDRIVE_API_TOKEN",
  },
  calendly: {
    accessToken: "CALENDLY_ACCESS_TOKEN",
  },
  calcom: {
    accessToken: "CALCOM_API_KEY",
  },
  ga4: {
    accessToken: "GA4_ACCESS_TOKEN",
    accountId: "GA4_PROPERTY_ID",
  },
  search_console: {
    accessToken: "SEARCH_CONSOLE_ACCESS_TOKEN",
    baseUrl: "SEARCH_CONSOLE_SITE_URL",
  },
  youtube: {
    accessToken: "YOUTUBE_API_KEY",
  },
  instagram: {
    accessToken: "INSTAGRAM_ACCESS_TOKEN",
    accountId: "INSTAGRAM_BUSINESS_ID",
  },
  x: {
    accessToken: "X_BEARER_TOKEN",
  },
  google_business_profile: {
    accessToken: "GBP_ACCESS_TOKEN",
    accountId: "GBP_ACCOUNT_ID",
  },
  "google-ads": {
    accessToken: "GOOGLE_ADS_ACCESS_TOKEN",
    accountId: "GOOGLE_ADS_CUSTOMER_ID",
  },
  loom: {
    accessToken: "LOOM_ACCESS_TOKEN",
  },
  upwork: {
    accessToken: "UPWORK_ACCESS_TOKEN",
  },
};

function envVal(name: string | undefined): string | null {
  if (!name) return null;
  const v = process.env[name]?.trim();
  return v || null;
}

/**
 * Resolve credentials for a provider. Checks DB configJson first, then env vars.
 */
export async function getCredentials(provider: string): Promise<ProviderCredentials> {
  const canonical = resolveProviderKey(provider);
  const envDef = ENV_MAP[canonical];

  const conn = await db.integrationConnection.findUnique({
    where: { provider: canonical },
    select: { configJson: true },
  });

  const config = (conn?.configJson ?? {}) as Record<string, unknown>;
  const dbToken = typeof config.accessToken === "string" && config.accessToken ? config.accessToken : null;
  const dbAccountId = typeof config.accountId === "string" && config.accountId ? config.accountId : null;
  const dbPixelId = typeof config.pixelId === "string" && config.pixelId ? config.pixelId : null;
  const dbCapiToken = typeof config.capiToken === "string" && config.capiToken ? config.capiToken : null;
  const dbBaseUrl = typeof config.baseUrl === "string" && config.baseUrl ? config.baseUrl : null;
  const dbBookingUrl = typeof config.bookingUrl === "string" && config.bookingUrl ? config.bookingUrl : null;

  const accessToken = dbToken ?? envVal(envDef?.accessToken);
  const accountId = dbAccountId ?? envVal(envDef?.accountId);
  const pixelId = dbPixelId ?? envVal(envDef?.pixelId);
  const capiToken = dbCapiToken ?? envVal(envDef?.capiToken);
  const baseUrl = dbBaseUrl ?? envVal(envDef?.baseUrl);

  const hasDb = !!(dbToken || dbAccountId || dbPixelId || dbCapiToken || dbBaseUrl || dbBookingUrl);
  const hasEnv = !!(accessToken || accountId || pixelId || capiToken || baseUrl);
  const source: "db" | "env" | "none" = hasDb ? "db" : hasEnv ? "env" : "none";

  return {
    accessToken,
    accountId,
    pixelId,
    capiToken,
    baseUrl,
    bookingUrl: dbBookingUrl,
    extra: config,
    source,
  };
}

/**
 * Return credentials for the API list view — secrets masked.
 * Non-secret fields (accountId, pixelId, baseUrl, bookingUrl) shown in full.
 */
export async function getCredentialsSummary(provider: string): Promise<{
  hasAccessToken: boolean;
  hasCapiToken: boolean;
  accountId: string | null;
  pixelId: string | null;
  baseUrl: string | null;
  bookingUrl: string | null;
  source: "db" | "env" | "none";
  maskedAccessToken: string | null;
  maskedCapiToken: string | null;
}> {
  const creds = await getCredentials(provider);
  return {
    hasAccessToken: !!creds.accessToken,
    hasCapiToken: !!creds.capiToken,
    accountId: creds.accountId,
    pixelId: creds.pixelId,
    baseUrl: creds.baseUrl,
    bookingUrl: creds.bookingUrl,
    source: creds.source,
    maskedAccessToken: maskSecret(creds.accessToken),
    maskedCapiToken: maskSecret(creds.capiToken),
  };
}

function maskSecret(value: string | null): string | null {
  if (!value) return null;
  if (value.length <= 8) return "••••••••";
  return value.slice(0, 4) + "••••" + value.slice(-4);
}

/**
 * Quick helper — get Meta access token (DB > env).
 * Used by meta-ads clients to avoid scattered process.env reads.
 */
export async function getMetaAccessToken(): Promise<string | null> {
  const creds = await getCredentials("meta");
  return creds.accessToken;
}

export async function getMetaAccountId(): Promise<string | null> {
  const creds = await getCredentials("meta");
  return creds.accountId;
}

/** Returns the env var names for a provider (for display in UI). */
export function getEnvVarNames(provider: string): EnvMapping | undefined {
  const canonical = resolveProviderKey(provider);
  return ENV_MAP[canonical];
}
