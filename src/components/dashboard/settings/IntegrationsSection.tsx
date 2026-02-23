"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import type { IntegrationProvider } from "@/lib/integrations/providers";

type Connection = {
  id: string;
  status: string;
  accountLabel: string | null;
  isEnabled: boolean;
  lastSyncedAt: string | null;
  lastTestedAt: string | null;
  lastError: string | null;
  configJson?: Record<string, unknown>;
};

type Item = IntegrationProvider & {
  connection: Connection | null;
};

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

export function IntegrationsSection() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [configOpen, setConfigOpen] = useState<Item | null>(null);
  const [configAccessToken, setConfigAccessToken] = useState("");
  const [configAccountId, setConfigAccountId] = useState("");
  const [configBaseUrl, setConfigBaseUrl] = useState("");
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
    setConfigOpen(item);
    setConfigAccessToken((config?.accessToken as string) ?? "");
    setConfigAccountId((config?.accountId as string) ?? "");
    setConfigBaseUrl((config?.baseUrl as string) ?? "");
    setConfigEnabled(conn?.isEnabled ?? true);
    setTestResult(null);
  }

  async function saveConfig() {
    if (!configOpen) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/integrations/${configOpen.key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          configJson: {
            accessToken: configAccessToken || undefined,
            accountId: configAccountId || undefined,
            baseUrl: configBaseUrl || undefined,
          },
          status: configAccessToken ? "connected" : "not_connected",
          isEnabled: configEnabled,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setItems((prev) =>
          prev.map((i) =>
            i.key === configOpen.key
              ? {
                  ...i,
                  connection: {
                    id: data.id,
                    status: data.status,
                    accountLabel: data.accountLabel,
                    isEnabled: data.isEnabled,
                    lastSyncedAt: data.lastSyncedAt,
                    lastTestedAt: data.lastTestedAt,
                    lastError: data.lastError,
                  },
                }
              : i
          )
        );
        setConfigOpen(null);
      } else {
        const err = await res.json();
        alert(err.error ?? "Save failed");
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
      setTestResult(data.ok ? `OK: ${data.message}` : `Failed: ${data.message}`);
      if (res.ok) {
        const listRes = await fetch("/api/integrations");
        const listData = await listRes.json();
        setItems(listData?.items ?? items);
      }
    } catch {
      setTestResult("Request failed");
    }
  }

  async function disconnect(item: Item) {
    if (!confirm(`Disconnect ${item.name}?`)) return;
    try {
      const res = await fetch(`/api/integrations/${item.key}/disconnect`, { method: "POST" });
      if (res.ok) {
        setItems((prev) =>
          prev.map((i) =>
            i.key === item.key
              ? { ...i, connection: { ...i.connection!, status: "not_connected", isEnabled: false } }
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
        <h2 className="text-sm font-medium text-neutral-300">Integrations</h2>
        <p className="text-xs text-neutral-500 mt-2">Loading…</p>
      </section>
    );
  }

  return (
    <>
      <section className="border border-neutral-800 rounded-lg p-6 space-y-4">
        <h2 className="text-sm font-medium text-neutral-300">Integrations</h2>
        <p className="text-xs text-neutral-500">
          Manage platform connections. V1: config stored; most platforms are placeholders until OAuth/API flows are built.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.key}
              className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium text-neutral-200">{item.name}</h3>
                  <p className="text-xs text-neutral-500 mt-0.5">{item.usedBy}</p>
                </div>
                {statusBadge(item.connection?.status ?? "not_connected", item.connection?.isEnabled ?? true)}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => openConfig(item)}>
                  {item.connection ? "Configure" : "Connect"}
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
                <label className="block text-xs text-neutral-500 mb-1">API token / access token</label>
                <Input
                  type="password"
                  value={configAccessToken}
                  onChange={(e) => setConfigAccessToken(e.target.value)}
                  placeholder="Optional; use env vars for secrets"
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
                <label className="block text-xs text-neutral-500 mb-1">Base URL / webhook</label>
                <Input
                  value={configBaseUrl}
                  onChange={(e) => setConfigBaseUrl(e.target.value)}
                  placeholder="Optional"
                  className="w-full"
                />
              </div>
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
