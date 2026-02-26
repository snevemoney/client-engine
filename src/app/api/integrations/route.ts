/**
 * GET /api/integrations — List all integration connections + provider definitions.
 * Surfaces credential status (masked), platform URLs, and env-var fallback info.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PROVIDER_REGISTRY, getProviderDef } from "@/lib/integrations/providerRegistry";
import { getCredentialsSummary } from "@/lib/integrations/credentials";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/integrations", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const connections = await db.integrationConnection.findMany({
      orderBy: { provider: "asc" },
    });

    const byProvider = Object.fromEntries(connections.map((c) => [c.provider, c]));

    const items = await Promise.all(
      [...PROVIDER_REGISTRY]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(async (p) => {
          const c = byProvider[p.provider];
          const creds = await getCredentialsSummary(p.provider);
          const envConfigured = creds.source !== "none";

          return {
            key: p.provider,
            name: p.displayName,
            usedBy: "",
            hasRealTest: p.hasRealTest ?? false,
            category: p.category,
            prodOnly: p.prodOnly,
            helpText: p.helpText,
            sortOrder: p.sortOrder,
            supportsQueryParams: p.supportsQueryParams ?? false,
            platformUrl: p.platformUrl ?? null,
            apiKeyUrl: p.apiKeyUrl ?? null,
            credentials: creds,
            connection: c
              ? {
                  id: c.id,
                  status: c.status,
                  mode: c.mode,
                  category: c.category ?? p.category,
                  prodOnly: c.prodOnly ?? p.prodOnly,
                  displayName: c.displayName ?? c.providerLabel ?? p.displayName,
                  helpText: c.helpText ?? p.helpText,
                  providerLabel: c.providerLabel ?? c.displayName ?? p.displayName,
                  sortOrder: c.sortOrder ?? p.sortOrder,
                  accountLabel: c.accountLabel,
                  isEnabled: c.isEnabled,
                  lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
                  lastTestedAt: c.lastTestedAt?.toISOString() ?? null,
                  lastTestStatus: c.lastTestStatus ?? "never",
                  lastError: c.lastError,
                  configJson: c.configJson,
                }
              : {
                  id: null,
                  status: envConfigured ? "connected" : "not_connected",
                  mode: p.defaultMode,
                  category: p.category,
                  prodOnly: p.prodOnly,
                  displayName: p.displayName,
                  helpText: p.helpText,
                  providerLabel: p.displayName,
                  sortOrder: p.sortOrder,
                  accountLabel: null,
                  isEnabled: true,
                  lastSyncedAt: null,
                  lastTestedAt: null,
                  lastTestStatus: "never" as const,
                  lastError: null,
                  configJson: null,
                },
          };
        })
    );

    const registryKeys = new Set(PROVIDER_REGISTRY.map((r) => r.provider));
    for (const c of connections) {
      if (registryKeys.has(c.provider)) continue;
      const fallback = getProviderDef(c.provider) ?? {
        provider: c.provider,
        displayName: c.provider,
        category: "ops" as const,
        prodOnly: false,
        defaultMode: "off" as const,
        supportsLive: true,
        supportsMock: true,
        supportsManual: true,
        sortOrder: 999,
      };
      items.push({
        key: c.provider,
        name: fallback.displayName,
        usedBy: "",
        hasRealTest: false,
        category: fallback.category,
        prodOnly: fallback.prodOnly,
        helpText: fallback.helpText,
        sortOrder: fallback.sortOrder,
        supportsQueryParams: false,
        platformUrl: null,
        apiKeyUrl: null,
        credentials: {
          hasAccessToken: false, hasCapiToken: false,
          accountId: null, pixelId: null, baseUrl: null, bookingUrl: null,
          source: "none" as const, maskedAccessToken: null, maskedCapiToken: null,
        },
        connection: {
          id: c.id,
          status: c.status,
          mode: c.mode,
          category: c.category ?? fallback.category,
          prodOnly: c.prodOnly ?? fallback.prodOnly,
          displayName: c.displayName ?? c.providerLabel ?? fallback.displayName,
          helpText: c.helpText ?? fallback.helpText,
          providerLabel: c.providerLabel ?? c.displayName ?? fallback.displayName,
          sortOrder: c.sortOrder ?? fallback.sortOrder,
          accountLabel: c.accountLabel,
          isEnabled: c.isEnabled,
          lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
          lastTestedAt: c.lastTestedAt?.toISOString() ?? null,
          lastTestStatus: c.lastTestStatus ?? "never",
          lastError: c.lastError,
          configJson: c.configJson,
        },
      });
    }

    items.sort((a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100));

    return NextResponse.json({ items });
  });
}
