"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, ExternalLink, Key } from "lucide-react";
import type { IntegrationProvider } from "@/lib/integrations/providers";

type IntegrationMode = "off" | "mock" | "manual" | "live";

type Credentials = {
  hasAccessToken: boolean;
  hasCapiToken: boolean;
  accountId: string | null;
  pixelId: string | null;
  baseUrl: string | null;
  bookingUrl: string | null;
  source: "db" | "env" | "none";
  maskedAccessToken: string | null;
  maskedCapiToken: string | null;
};

type Connection = {
  id: string | null;
  status: string;
  mode: IntegrationMode;
  category: string;
  prodOnly: boolean;
  displayName?: string | null;
  helpText?: string | null;
  accountLabel: string | null;
  isEnabled: boolean;
  lastSyncedAt: string | null;
  lastTestedAt: string | null;
  lastTestStatus: string;
  lastError: string | null;
  configJson?: Record<string, unknown> | null;
  credentials?: Credentials;
};

type Item = IntegrationProvider & {
  connection: Connection;
  platformUrl?: string;
  apiKeyUrl?: string;
};

const MODE_HELPER: Record<IntegrationMode, string> = {
  off: "Turned off",
  mock: "Test mode — no real data sent",
  manual: "You handle it yourself, we just track it",
  live: "Fully connected and active",
};

function formatRelative(iso: string): string {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (!Number.isFinite(diff) || diff < 0) return "";
    if (diff < 60_000) return "just now";
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
    return `${Math.floor(diff / 86400_000)}d ago`;
  } catch {
    return "";
  }
}

function statusBadge(status: string, isEnabled: boolean) {
  if (!isEnabled) return <Badge variant="outline">Disabled</Badge>;
  switch (status) {
    case "connected":
      return <Badge className="bg-emerald-600/30 text-emerald-400 border-emerald-700">Connected</Badge>;
    case "error":
      return <Badge className="bg-red-600/30 text-red-400 border-red-700">Error</Badge>;
    case "disabled":
      return <Badge variant="outline">Disabled</Badge>;
    default:
      return <Badge variant="outline">Not connected</Badge>;
  }
}

function modeBadge(mode: IntegrationMode | string | undefined) {
  const m = (mode ?? "off").toLowerCase() as IntegrationMode;
  const styles: Record<IntegrationMode, string> = {
    off: "bg-neutral-700/50 text-neutral-400 border-neutral-600",
    mock: "bg-amber-600/30 text-amber-400 border-amber-700",
    manual: "bg-blue-600/30 text-blue-400 border-blue-700",
    live: "bg-emerald-600/30 text-emerald-400 border-emerald-700",
  };
  const labels: Record<IntegrationMode, string> = { off: "Off", mock: "Test", manual: "Manual", live: "Live" };
  return <Badge variant="outline" className={styles[m] ?? styles.off}>{labels[m] ?? m}</Badge>;
}

function sourceBadge(source: Credentials["source"] | undefined) {
  if (source === "env") {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-600/20 text-amber-400 border border-amber-700/50">
        from .env
      </span>
    );
  }
  if (source === "db") {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-emerald-600/20 text-emerald-400 border border-emerald-700/50">
        Saved
      </span>
    );
  }
  return null;
}

function credentialSummary(creds: Credentials | undefined) {
  if (!creds) return null;
  const parts: string[] = [];
  if (creds.maskedAccessToken) parts.push(`Token: ${creds.maskedAccessToken}`);
  if (creds.accountId) parts.push(`Account: ${creds.accountId}`);
  if (creds.pixelId) parts.push(`Pixel: ${creds.pixelId}`);
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

export function IntegrationsSection() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [configOpen, setConfigOpen] = useState<Item | null>(null);
  const [configAccessToken, setConfigAccessToken] = useState("");
  const [configAccountId, setConfigAccountId] = useState("");
  const [configBaseUrl, setConfigBaseUrl] = useState("");
  const [configBookingUrl, setConfigBookingUrl] = useState("");
  const [configDisplayName, setConfigDisplayName] = useState("");
  const [configQueryParams, setConfigQueryParams] = useState<{ key: string; value: string }[]>([]);
  const [configMode, setConfigMode] = useState<IntegrationMode>("off");
  const [configEnabled, setConfigEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/integrations")
      .then((r) => r.json())
      .then((data) => setItems(data?.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  function openConfig(item: Item) {
    const conn = item.connection;
    const config = conn?.configJson as Record<string, unknown> | undefined;
    const creds = conn?.credentials;
    const hasConfig = config && Object.keys(config).length > 0;
    const qp =
      (config?.additionalQueryParams as Record<string, string> | undefined) ??
      (config?.queryParams as Record<string, string> | undefined);
    setConfigOpen(item);
    setConfigAccessToken((config?.accessToken as string) ?? "");
    setConfigAccountId(
      (config?.accountId as string) ?? (!hasConfig && creds?.accountId ? creds.accountId : ""),
    );
    setConfigBaseUrl(
      (config?.baseUrl as string) ?? (!hasConfig && creds?.baseUrl ? creds.baseUrl : ""),
    );
    setConfigBookingUrl(
      (config?.bookingUrl as string) ?? (!hasConfig && creds?.bookingUrl ? creds.bookingUrl : ""),
    );
    setConfigDisplayName((config?.displayName as string) ?? "");
    setConfigQueryParams(qp ? Object.entries(qp).map(([k, v]) => ({ key: k, value: String(v) })) : []);
    setConfigMode((conn?.mode as IntegrationMode) ?? "off");
    setConfigEnabled(conn?.isEnabled ?? true);
    setTestResult(null);
  }

  async function saveConfig() {
    if (!configOpen) return;
    setSaving(true);
    try {
      const existingConfig = (configOpen.connection.configJson as Record<string, unknown>) ?? {};
      const qpEntries = configQueryParams
        .filter((p) => p.key.trim())
        .map((p) => [p.key.trim(), p.value] as [string, string]);
      const hasDuplicateKeys = new Set(qpEntries.map(([k]) => k)).size < qpEntries.length;
      if (hasDuplicateKeys) {
        alert("Duplicate keys in query parameters. Remove duplicates.");
        setSaving(false);
        return;
      }
      const configJson: Record<string, unknown> = {
        ...existingConfig,
        accessToken: configAccessToken || undefined,
        accountId: configAccountId || undefined,
        baseUrl: configBaseUrl || undefined,
        bookingUrl: configBookingUrl || undefined,
        displayName: configDisplayName || undefined,
      };
      if (configOpen.supportsQueryParams) {
        configJson.additionalQueryParams =
          qpEntries.length > 0 ? Object.fromEntries(qpEntries) : undefined;
      }
      const res = await fetch(`/api/integrations/${configOpen.key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          configJson,
          status: configAccessToken ? "connected" : "not_connected",
          mode: configMode,
          isEnabled: configEnabled,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setItems((prev) =>
          prev.map((i) =>
            i.key === configOpen.key
              ? {
                  ...i,
                  connection: {
                    ...i.connection,
                    id: data.id,
                    status: data.status,
                    mode: data.mode ?? configMode,
                    category: data.category ?? configOpen.connection.category,
                    prodOnly: data.prodOnly ?? configOpen.connection.prodOnly,
                    displayName: data.displayName ?? data.providerLabel ?? i.connection.displayName,
                    helpText: data.helpText ?? i.connection.helpText,
                    accountLabel: data.accountLabel,
                    isEnabled: data.isEnabled,
                    lastSyncedAt: data.lastSyncedAt,
                    lastTestedAt: data.lastTestedAt,
                    lastTestStatus: data.lastTestStatus ?? "never",
                    lastError: data.lastError,
                    configJson: data.configJson ?? configJson,
                  },
                }
              : i
          )
        );
        setConfigOpen(null);
      } else {
        alert(data?.error ?? data?.message ?? "Save failed");
      }
    } catch {
      alert("Save failed");
    }
    setSaving(false);
  }

  async function testConnection(item: Item) {
    setTestResult(null);
    try {
      const res = await fetch(`/api/integrations/${item.key}/test`, { method: "POST" });
      const data = await res.json();
      const msg = data.message ?? (data.ok ? "OK" : "Failed");
      if (data.ok) {
        setTestResult(`✓ ${msg}`);
      } else {
        setTestResult(`✗ ${msg}`);
      }
      if (res.ok && data.ok) {
        const listRes = await fetch("/api/integrations");
        const listData = await listRes.json();
        setItems(listData?.items ?? items);
      }
    } catch {
      setTestResult("✗ Request failed");
    }
  }

  async function disconnect(item: Item) {
    const label = item.connection.displayName ?? item.name ?? item.key;
    if (!confirm(`Disconnect ${label}?`)) return;
    try {
      const res = await fetch(`/api/integrations/${item.key}/disconnect`, { method: "POST" });
      if (res.ok) {
        setItems((prev) =>
          prev.map((i) =>
            i.key === item.key
              ? { ...i, connection: { ...i.connection, status: "not_connected", isEnabled: false } }
              : i
          )
        );
        if (configOpen?.key === item.key) setConfigOpen(null);
      }
    } catch {
      alert("Disconnect failed");
    }
  }

  if (loading) {
    return (
      <section className="border border-neutral-800 rounded-lg p-6">
        <h2 className="text-base font-medium text-neutral-200">Connections</h2>
        <p className="text-xs text-neutral-500 mt-2">Loading…</p>
      </section>
    );
  }

  return (
    <>
      <section className="border border-neutral-800 rounded-lg p-6 space-y-4">
        <h2 className="text-base font-medium text-neutral-200">Connections</h2>
        <p className="text-xs text-neutral-500">
          Connect your tools and platforms. Turn them on or off, or test if they&apos;re working.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.key}
              className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-neutral-200">
                    {item.connection?.displayName ?? item.name ?? item.key}
                  </h3>
                  {item.usedBy && <p className="text-xs text-neutral-500 mt-0.5">{item.usedBy}</p>}
                  {(item.connection?.helpText ?? item.helpText) && (
                    <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">
                      {item.connection?.helpText ?? item.helpText}
                    </p>
                  )}
                  {item.connection?.category && (
                    <span className="text-xs text-neutral-600 capitalize mt-0.5 inline-block">
                      {(item.connection.category ?? "").replace(/_/g, " ")}
                    </span>
                  )}
                  {credentialSummary(item.connection?.credentials) && (
                    <p className="text-[11px] text-neutral-600 mt-0.5 font-mono truncate">
                      {credentialSummary(item.connection?.credentials)}
                    </p>
                  )}
                  {(item.connection?.lastTestedAt || item.connection?.lastSyncedAt) && (
                    <p className="text-xs text-neutral-500 mt-1">
                      {item.connection?.lastTestedAt && `Tested ${formatRelative(item.connection.lastTestedAt)}`}
                      {item.connection?.lastTestedAt && item.connection?.lastSyncedAt && " · "}
                      {item.connection?.lastSyncedAt && `Synced ${formatRelative(item.connection.lastSyncedAt)}`}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex gap-1 flex-wrap justify-end">
                    {modeBadge(item.connection?.mode ?? "off")}
                    {item.connection?.prodOnly && (
                      <Badge variant="outline" className="text-neutral-500 border-neutral-600" title="Only works in live mode when deployed">Live only</Badge>
                    )}
                    {statusBadge(item.connection?.status ?? "not_connected", item.connection?.isEnabled ?? true)}
                    {sourceBadge(item.connection?.credentials?.source)}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => openConfig(item)}>
                  {item.connection?.id ? "Configure" : "Connect"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => testConnection(item)}>
                  Test
                </Button>
                {item.connection?.status !== "not_connected" && (
                  <Button size="sm" variant="ghost" onClick={() => disconnect(item)} className="text-red-400 hover:text-red-300">
                    Disconnect
                  </Button>
                )}
              </div>
              {(item.platformUrl || item.apiKeyUrl) && (
                <div className="flex gap-3">
                  {item.platformUrl && (
                    <a
                      href={item.platformUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open {item.name}
                    </a>
                  )}
                  {item.apiKeyUrl && (
                    <a
                      href={item.apiKeyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                    >
                      <Key className="w-3 h-3" />
                      Get API key
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Config modal */}
      {configOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => setConfigOpen(null)}
            aria-label="Close"
          />
          <div className="relative w-full max-w-md rounded-lg border border-neutral-700 bg-neutral-950 p-6 shadow-xl mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-neutral-200">Configure {configOpen.name}</h3>
              <button
                type="button"
                onClick={() => setConfigOpen(null)}
                className="text-neutral-500 hover:text-neutral-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Mode</label>
                <select
                  value={configMode}
                  onChange={(e) => setConfigMode(e.target.value as IntegrationMode)}
                  className="w-full rounded-md border border-neutral-600 bg-neutral-900 px-3 py-2 text-neutral-200"
                >
                  <option value="off">Off</option>
                  <option value="mock">Test mode</option>
                  <option value="manual">Manual</option>
                  <option value="live" disabled={configOpen?.connection?.prodOnly && typeof window !== "undefined" && window.location?.hostname === "localhost"}>
                    Live{configOpen?.connection?.prodOnly && typeof window !== "undefined" && window.location?.hostname === "localhost" ? " (production only)" : ""}
                  </option>
                </select>
                <p className="text-xs text-neutral-500 mt-1">{MODE_HELPER[configMode]}</p>
                {configOpen?.connection?.prodOnly &&
                  typeof window !== "undefined" &&
                  window.location?.hostname === "localhost" && (
                    <p className="text-xs text-amber-400/90 mt-2 rounded bg-amber-950/40 px-2 py-1.5">
                      Live mode only works in production. Use Test or Manual for now.
                    </p>
                  )}
                {configOpen?.helpText && !configOpen?.connection?.prodOnly && (
                  <p className="text-xs text-neutral-500 mt-2">{configOpen.helpText}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Access token</label>
                <Input
                  type="password"
                  value={configAccessToken}
                  onChange={(e) => setConfigAccessToken(e.target.value)}
                  placeholder={
                    configOpen.connection?.credentials?.maskedAccessToken
                      ? `${configOpen.connection.credentials.maskedAccessToken} (from .env)`
                      : "Paste your token here (optional)"
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Account ID</label>
                <Input
                  value={configAccountId}
                  onChange={(e) => setConfigAccountId(e.target.value)}
                  placeholder="e.g. act_123"
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Website address or link</label>
                <Input
                  value={configBaseUrl}
                  onChange={(e) => setConfigBaseUrl(e.target.value)}
                  placeholder="Optional"
                  className="w-full"
                />
              </div>
              {(configOpen.key === "calendly" || configOpen.key === "calcom") && (
                <>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Booking URL (manual mode)</label>
                    <Input
                      value={configBookingUrl}
                      onChange={(e) => setConfigBookingUrl(e.target.value)}
                      placeholder="https://calendly.com/you or Cal.com link"
                      className="w-full"
                    />
                    <p className="text-xs text-neutral-600 mt-1">Your scheduling link for manual mode.</p>
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Display name (optional)</label>
                    <Input
                      value={configDisplayName}
                      onChange={(e) => setConfigDisplayName(e.target.value)}
                      placeholder="e.g. Strategy Call"
                      className="w-full"
                    />
                  </div>
                  {configBookingUrl && (
                    <p className="text-xs text-emerald-500">Manual link configured</p>
                  )}
                </>
              )}
              {configOpen.supportsQueryParams && (
                <div>
                  <label className="block text-xs text-neutral-500 mb-1">
                    Extra settings
                  </label>
                  <p className="text-xs text-neutral-600 mb-2">
                    Optional key/value pairs for advanced configuration.
                  </p>
                  <div className="space-y-2">
                    {configQueryParams.map((p, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          value={p.key}
                          onChange={(e) =>
                            setConfigQueryParams((prev) =>
                              prev.map((x, j) => (j === i ? { ...x, key: e.target.value } : x))
                            )
                          }
                          placeholder="key"
                          className="flex-1"
                        />
                        <Input
                          value={p.value}
                          onChange={(e) =>
                            setConfigQueryParams((prev) =>
                              prev.map((x, j) => (j === i ? { ...x, value: e.target.value } : x))
                            )
                          }
                          placeholder="value"
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setConfigQueryParams((prev) => prev.filter((_, j) => j !== i))
                          }
                          className="text-neutral-500 shrink-0"
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const hasEmpty = configQueryParams.some((x) => !x.key.trim());
                        if (!hasEmpty) setConfigQueryParams((prev) => [...prev, { key: "", value: "" }]);
                      }}
                    >
                      Add row
                    </Button>
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={configEnabled}
                  onChange={(e) => setConfigEnabled(e.target.checked)}
                  className="rounded border-neutral-600"
                />
                <span className="text-neutral-400">Enabled</span>
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={saveConfig} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button variant="outline" onClick={() => testConnection(configOpen)}>
                Test
              </Button>
              {testResult && (
                <span className="text-xs self-center text-neutral-500">{testResult}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
