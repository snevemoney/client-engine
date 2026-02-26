/**
 * Server-side helper to fetch live data from an integration connection.
 * Used by dashboard pages to display connection-sourced data.
 */
import { db } from "@/lib/db";
import { runProvider } from "./clients";
import type { IntegrationMode } from "./providerRegistry";

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
  const hasCredentials = !!(config.accessToken || process.env[`${provider.toUpperCase()}_ACCESS_TOKEN`]);
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

export async function getAllConnectionStatuses(): Promise<ConnectionStatus[]> {
  const connections = await db.integrationConnection.findMany({
    orderBy: { provider: "asc" },
  });
  return connections.map((conn) => {
    const config = (conn.configJson ?? {}) as Record<string, unknown>;
    return {
      provider: conn.provider,
      isEnabled: conn.isEnabled,
      mode: conn.mode as IntegrationMode,
      status: conn.status,
      lastSyncedAt: conn.lastSyncedAt?.toISOString() ?? null,
      hasCredentials: !!config.accessToken,
    };
  });
}
