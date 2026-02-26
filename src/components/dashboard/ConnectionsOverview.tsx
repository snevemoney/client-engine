"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wifi, WifiOff, Settings } from "lucide-react";
import type { IntegrationPurpose } from "@/lib/integrations/providerRegistry";

type ConnectionInfo = {
  provider: string;
  isEnabled: boolean;
  mode: string;
  status: string;
  hasCredentials: boolean;
  lastSyncedAt: string | null;
};

type ConnectionsOverviewProps = {
  /** When set, only integrations serving this purpose are shown. Omit for all. */
  purpose?: IntegrationPurpose | IntegrationPurpose[];
};

export function ConnectionsOverview({ purpose }: ConnectionsOverviewProps = {}) {
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const purposeParam =
    purpose !== undefined
      ? typeof purpose === "string"
        ? purpose
        : purpose.join(",")
      : "";

  useEffect(() => {
    const url = purposeParam
      ? `/api/integrations/data?statuses=1&purpose=${encodeURIComponent(purposeParam)}`
      : "/api/integrations/data?statuses=1";
    fetch(url)
      .then((r) => r.json())
      .then((d) => setConnections(d.statuses ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [purposeParam]);

  if (loading) return null;

  const active = connections.filter((c) => c.isEnabled && c.mode !== "off");
  const inactive = connections.filter((c) => !c.isEnabled || c.mode === "off");

  return (
    <section className="border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-neutral-300">Integrations</h3>
        <Link
          href="/dashboard/settings"
          className="text-[10px] text-neutral-500 hover:text-neutral-300 flex items-center gap-1"
        >
          <Settings className="h-3 w-3" /> Configure
        </Link>
      </div>
      {connections.length === 0 ? (
        <p className="text-xs text-neutral-500">No integrations configured yet.</p>
      ) : (
        <div className="space-y-1.5">
          {active.map((c) => (
            <div key={c.provider} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <Wifi className="h-3 w-3 text-green-500" />
                <span className="text-neutral-300 capitalize">{c.provider}</span>
              </div>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                c.mode === "live" ? "bg-green-950/40 text-green-400" :
                c.mode === "mock" ? "bg-amber-950/40 text-amber-400" :
                "bg-blue-950/40 text-blue-400"
              }`}>
                {c.mode}
              </span>
            </div>
          ))}
          {inactive.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-600 pt-1 border-t border-neutral-800/50">
              <WifiOff className="h-3 w-3" />
              <span>{inactive.length} inactive</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
