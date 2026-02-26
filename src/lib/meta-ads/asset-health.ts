/**
 * Best-effort Meta asset health diagnostics.
 * Fetches account, permissions (via trial), pages, IG, pixels, WhatsApp.
 * Does not crash on partial failures.
 * Credentials resolved via @/lib/integrations/credentials (DB-first, env fallback).
 */

import { getMetaAccessToken } from "@/lib/integrations/credentials";

const API_VERSION = process.env.META_API_VERSION ?? "v21.0";
const BASE = `https://graph.facebook.com/${API_VERSION}`;
const TIMEOUT_MS = 15000;

let _cachedToken: string | null = null;
let _tokenCachedAt = 0;
const TOKEN_TTL_MS = 60_000;

async function resolveToken(): Promise<string> {
  if (_cachedToken && Date.now() - _tokenCachedAt < TOKEN_TTL_MS) return _cachedToken;
  const token = await getMetaAccessToken();
  if (!token) throw new Error("META_ACCESS_TOKEN not set");
  _cachedToken = token;
  _tokenCachedAt = Date.now();
  return token;
}

type HealthCheck = { key: string; label: string; status: "pass" | "warn" | "fail"; detail: string };

async function metaGet(path: string, params: Record<string, string> = {}): Promise<unknown> {
  const token = await resolveToken();

  const url = new URL(`${BASE}/${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(TIMEOUT_MS) });
  return res.json();
}

function hasPermission(scopes: string[], perm: string): boolean {
  return scopes.some((s) => s.toLowerCase() === perm.toLowerCase());
}

export type AssetHealthResult = {
  ok: boolean;
  account: { id: string; name?: string; status?: string; currency?: string; timezone_name?: string };
  permissions: {
    ads_read: boolean;
    ads_management: boolean;
    business_management: boolean;
    pages_show_list: boolean;
    pages_read_engagement: boolean;
    pages_messaging: boolean;
    pages_manage_metadata: boolean;
    whatsapp_business_management: boolean;
    whatsapp_business_messaging: boolean;
    catalog_management: boolean;
  };
  pages: Array<{ id: string; name?: string; connectedInstagram?: boolean }>;
  instagramAccounts: Array<{ id: string; username?: string }>;
  pixels: Array<{ id: string; name?: string }>;
  whatsapp: {
    businesses?: Array<{ id?: string; name?: string }>;
    phoneNumbers?: Array<{ id?: string; display_phone_number?: string }>;
    status: "connected" | "partial" | "missing" | "unknown";
  };
  checks: HealthCheck[];
  errors?: string[];
};

export async function fetchAssetHealth(accountId: string): Promise<AssetHealthResult> {
  const acc = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  const checks: HealthCheck[] = [];
  const errors: string[] = [];

  const defaultPerms = {
    ads_read: false,
    ads_management: false,
    business_management: false,
    pages_show_list: false,
    pages_read_engagement: false,
    pages_messaging: false,
    pages_manage_metadata: false,
    whatsapp_business_management: false,
    whatsapp_business_messaging: false,
    catalog_management: false,
  };

  let account = { id: acc, name: undefined as string | undefined, status: undefined as string | undefined, currency: undefined as string | undefined, timezone_name: undefined as string | undefined };
  let pages: AssetHealthResult["pages"] = [];
  const instagramAccounts: AssetHealthResult["instagramAccounts"] = [];
  let pixels: AssetHealthResult["pixels"] = [];
  let whatsapp: AssetHealthResult["whatsapp"] = { status: "unknown" as const };
  const permissions = { ...defaultPerms };

  // 1) Account info — requires ads_read
  try {
    const acctRes = (await metaGet(acc, { fields: "id,name,account_status,currency,timezone_name" })) as {
      id?: string;
      name?: string;
      account_status?: string;
      currency?: string;
      timezone_name?: string;
      error?: { message: string; code?: number };
    };
    if (acctRes.error) {
      if (String(acctRes.error.message || "").toLowerCase().includes("permission") || acctRes.error.code === 100) {
        permissions.ads_read = false;
        checks.push({ key: "ads_read", label: "ads_read", status: "fail", detail: "ads_read missing — dashboard and asset health unavailable" });
      }
      errors.push(acctRes.error.message ?? "Account fetch failed");
    } else {
      account = {
        id: acctRes.id ?? acc,
        name: acctRes.name,
        status: acctRes.account_status,
        currency: acctRes.currency,
        timezone_name: acctRes.timezone_name,
      };
      permissions.ads_read = true;
      checks.push({ key: "account", label: "Ad account", status: "pass", detail: `${account.name ?? acc} — ${account.currency ?? "—"} ${account.timezone_name ?? ""}` });
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
    checks.push({ key: "account", label: "Ad account", status: "fail", detail: e instanceof Error ? e.message : "Failed to fetch" });
  }

  // 2) Debug token for permissions (best-effort; needs app token)
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (appId && appSecret && permissions.ads_read) {
    try {
      const appToken = `${appId}|${appSecret}`;
      const inputToken = await resolveToken();
      const debugRes = (await fetch(`${BASE}/debug_token?input_token=${encodeURIComponent(inputToken)}&access_token=${encodeURIComponent(appToken)}`).then((r) => r.json())) as {
        data?: { scopes?: string[] };
      };
      const scopes = debugRes.data?.scopes ?? [];
      permissions.ads_read = hasPermission(scopes, "ads_read");
      permissions.ads_management = hasPermission(scopes, "ads_management");
      permissions.business_management = hasPermission(scopes, "business_management");
      permissions.pages_show_list = hasPermission(scopes, "pages_show_list");
      permissions.pages_read_engagement = hasPermission(scopes, "pages_read_engagement");
      permissions.pages_messaging = hasPermission(scopes, "pages_messaging");
      permissions.pages_manage_metadata = hasPermission(scopes, "pages_manage_metadata");
      permissions.whatsapp_business_management = hasPermission(scopes, "whatsapp_business_management");
      permissions.whatsapp_business_messaging = hasPermission(scopes, "whatsapp_business_messaging");
      permissions.catalog_management = hasPermission(scopes, "catalog_management");

      if (!permissions.ads_management) {
        checks.push({ key: "ads_management", label: "ads_management", status: "warn", detail: "ads_management missing — pause/resume actions unavailable" });
      }
    } catch {
      // Without app credentials we can't debug; infer from trial
      if (permissions.ads_read) {
        checks.push({ key: "ads_management", label: "ads_management", status: "warn", detail: "Cannot verify without META_APP_ID/META_APP_SECRET; pause/resume may fail if missing" });
      }
    }
  } else if (permissions.ads_read) {
    checks.push({ key: "perms_debug", label: "Permissions", status: "warn", detail: "Set META_APP_ID and META_APP_SECRET to verify permissions via debug_token" });
  }

  // 3) Pages — requires pages_show_list
  if (permissions.ads_read) {
    try {
      const pagesRes = (await metaGet(`${acc}/promote_pages`, { fields: "id,name,connected_instagram_account" })) as {
        data?: Array<{ id: string; name?: string; connected_instagram_account?: { id: string; username?: string } }>;
        error?: { message: string };
      };
      if (pagesRes.error) {
        if (String(pagesRes.error.message || "").toLowerCase().includes("permission")) {
          checks.push({ key: "pages", label: "Pages", status: "warn", detail: "No Pages visible — connect a Facebook Page or grant pages_show_list" });
        } else {
          checks.push({ key: "pages", label: "Pages", status: "warn", detail: pagesRes.error.message ?? "Failed to fetch" });
        }
      } else {
        const data = pagesRes.data ?? [];
        pages = data.map((p: { id: string; name?: string; connected_instagram_account?: { id: string; username?: string } }) => ({
          id: p.id,
          name: p.name,
          connectedInstagram: !!p.connected_instagram_account,
        }));
        for (const p of data as Array<{ connected_instagram_account?: { id: string; username?: string } }>) {
          if (p.connected_instagram_account) {
            instagramAccounts.push({
              id: p.connected_instagram_account.id,
              username: p.connected_instagram_account.username,
            });
          }
        }
        if (data.length > 0) {
          checks.push({ key: "pages", label: "Pages", status: "pass", detail: `${data.length} page(s) connected` });
        } else {
          checks.push({ key: "pages", label: "Pages", status: "warn", detail: "No Pages visible — connect a Facebook Page or grant pages_show_list" });
        }
      }
    } catch (e) {
      checks.push({ key: "pages", label: "Pages", status: "warn", detail: e instanceof Error ? e.message : "Failed to fetch" });
    }
  }

  // 4) Instagram — from pages (already populated above)
  if (permissions.ads_read && pages.length > 0) {
    if (instagramAccounts.length > 0) {
      checks.push({ key: "instagram", label: "Instagram", status: "pass", detail: `${instagramAccounts.length} account(s) connected` });
    } else {
      checks.push({ key: "instagram", label: "Instagram", status: "warn", detail: "No Instagram accounts linked to Pages" });
    }
  } else if (permissions.ads_read) {
    checks.push({ key: "instagram", label: "Instagram", status: "warn", detail: "Connect Pages first, then link Instagram" });
  }

  // 5) Pixels — via ad account
  if (permissions.ads_read) {
    try {
      const pxRes = (await metaGet(`${acc}/adspixels`, { fields: "id,name" })) as {
        data?: Array<{ id: string; name?: string }>;
        error?: { message: string };
      };
      if (pxRes.error) {
        checks.push({ key: "pixels", label: "Pixels", status: "warn", detail: "No Pixel found in accessible assets — verify Business Manager access" });
      } else {
        pixels = (pxRes.data ?? []).map((p) => ({ id: p.id, name: p.name }));
        if (pixels.length > 0) {
          checks.push({ key: "pixels", label: "Pixels", status: "pass", detail: `${pixels.length} pixel(s) — ${pixels.map((p) => p.name ?? p.id).join(", ")}` });
        } else {
          checks.push({ key: "pixels", label: "Pixels", status: "warn", detail: "No Pixel found in accessible assets — verify Business Manager access" });
        }
      }
    } catch (e) {
      checks.push({ key: "pixels", label: "Pixels", status: "warn", detail: e instanceof Error ? e.message : "Failed to fetch" });
    }
  }

  // 6) WhatsApp — best-effort
  if (permissions.ads_read) {
    try {
      const waRes = (await metaGet(`${acc}/owned_whatsapp_business_accounts`, { fields: "id,name" })) as {
        data?: Array<{ id: string; name?: string }>;
        error?: { message: string };
      };
      if (waRes.error) {
        whatsapp = { status: "missing" };
        checks.push({ key: "whatsapp", label: "WhatsApp", status: "warn", detail: "WhatsApp permissions present but no business account found, or permission missing" });
      } else {
        const businesses = waRes.data ?? [];
        whatsapp = { businesses, status: businesses.length > 0 ? "connected" : "missing" };
        if (businesses.length > 0) {
          checks.push({ key: "whatsapp", label: "WhatsApp", status: "pass", detail: `${businesses.length} business account(s)` });
        } else {
          checks.push({ key: "whatsapp", label: "WhatsApp", status: "warn", detail: "WhatsApp permissions present but no phone number found" });
        }
      }
    } catch {
      whatsapp = { status: "unknown" };
      checks.push({ key: "whatsapp", label: "WhatsApp", status: "warn", detail: "Could not fetch WhatsApp status" });
    }
  }

  const ok = permissions.ads_read && checks.filter((c) => c.status === "fail").length === 0;

  return {
    ok,
    account,
    permissions,
    pages,
    instagramAccounts,
    pixels,
    whatsapp,
    checks,
    errors: errors.length > 0 ? errors : undefined,
  };
}
