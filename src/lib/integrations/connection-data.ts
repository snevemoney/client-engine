/**
 * Server-side helper to fetch live data from an integration connection.
 * Used by dashboard pages to display connection-sourced data.
 *
 * Use purpose filtering when fetching for a specific context so only
 * relevant integrations are returned.
 */
import { db } from "@/lib/db";
import { runProvider } from "./clients";
import { filterProvidersByPurpose } from "./purpose-context";
import { configHasCredentials } from "./providerRegistry";
import type { IntegrationMode, IntegrationPurpose } from "./providerRegistry";

export type ConnectionStatus = {
  provider: string;
  isEnabled: boolean;
  mode: IntegrationMode;
  status: string;
  lastSyncedAt: string | null;
  hasCredentials: boolean;
};

export async function getConnectionStatus(provider: string): Promise<ConnectionStatus | null> {
  const conn = await db.integrationConnection.findUnique({
    where: { provider },
  });
  if (!conn) return null;
  const config = (conn.configJson ?? {}) as Record<string, unknown>;
  const hasCredentials = configHasCredentials(conn.provider, config);
  return {
    provider: conn.provider,
    isEnabled: conn.isEnabled,
    mode: conn.mode as IntegrationMode,
    status: conn.status,
    lastSyncedAt: conn.lastSyncedAt?.toISOString() ?? null,
    hasCredentials,
  };
}

export async function fetchConnectionData(provider: string) {
  const conn = await db.integrationConnection.findUnique({
    where: { provider },
  });
  if (!conn || !conn.isEnabled || conn.mode === "off") {
    return { ok: false, data: null, message: "Connection not enabled", status: conn };
  }
  const result = await runProvider({
    provider: conn.provider,
    mode: conn.mode as IntegrationMode,
    prodOnly: conn.prodOnly,
    configJson: (conn.configJson ?? {}) as Record<string, unknown>,
  });
  return { ...result, status: conn };
}

export async function getAllConnectionStatuses(
  purpose?: IntegrationPurpose | IntegrationPurpose[],
): Promise<ConnectionStatus[]> {
  const connections = await db.integrationConnection.findMany({
    orderBy: { provider: "asc" },
  });

  const purposes = purpose
    ? Array.isArray(purpose)
      ? purpose
      : [purpose]
    : [];

  const filtered = purposes.length > 0
    ? filterProvidersByPurpose(
        connections.map((c) => c.provider),
        purposes,
      )
    : connections.map((c) => c.provider);

  return connections
    .filter((conn) => filtered.includes(conn.provider))
    .map((conn) => {
      const config = (conn.configJson ?? {}) as Record<string, unknown>;
      return {
        provider: conn.provider,
        isEnabled: conn.isEnabled,
        mode: conn.mode as IntegrationMode,
        status: conn.status,
        lastSyncedAt: conn.lastSyncedAt?.toISOString() ?? null,
        hasCredentials: configHasCredentials(conn.provider, config),
      };
    });
}
