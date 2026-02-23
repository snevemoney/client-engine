"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Megaphone, AlertTriangle } from "lucide-react";
import type { MetaAdsDashboardData, MetaAdsDashboardError, DateRangePreset } from "@/lib/meta-ads/types";
import { MetaAdsKpiCards } from "./MetaAdsKpiCards";
import { MetaAdsCampaignTable } from "./MetaAdsCampaignTable";
import { MetaAdsAdSetTable } from "./MetaAdsAdSetTable";
import { MetaAdsAdTable } from "./MetaAdsAdTable";
import { MetaAdsInsightsPanel } from "./MetaAdsInsightsPanel";

const RANGES: { value: DateRangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last_7d", label: "7d" },
  { value: "last_14d", label: "14d" },
  { value: "last_30d", label: "30d" },
];

function errorMessage(err: MetaAdsDashboardError): string {
  switch (err.code) {
    case "NO_TOKEN":
      return "META_ACCESS_TOKEN not configured. Add it to .env and restart.";
    case "INVALID_TOKEN":
      return "Invalid or expired token. Generate a new one in Graph API Explorer or Business Settings.";
    case "PERMISSION_DENIED":
      return "Permission denied. Ensure ads_read is granted for your token.";
    case "RATE_LIMIT":
      return "Rate limit hit. Wait a few minutes and try again.";
    default:
      return err.error ?? "Failed to load. See docs/META_ADS_MONITOR_SETUP.md";
  }
}

export function MetaAdsPageClient() {
  const [range, setRange] = useState<DateRangePreset>("last_7d");
  const [data, setData] = useState<MetaAdsDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (opts?: { skipCache?: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      const skipCache = opts?.skipCache ? "&skipCache=1" : "";
      const res = await fetch(`/api/meta-ads/dashboard?range=${range}${skipCache}`);
      const json = (await res.json()) as MetaAdsDashboardData | MetaAdsDashboardError;
      if (!json.ok) {
        const err = json as MetaAdsDashboardError;
        setError(errorMessage(err));
        setData(null);
      } else {
        setData(json as MetaAdsDashboardData);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const needsAttention = data?.insights?.filter((i) => i.severity === "warn" || i.severity === "critical").length ?? 0;

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Megaphone className="w-6 h-6 text-neutral-400" />
          Meta Ads Monitor
          {needsAttention > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-900/50 px-2 py-0.5 text-xs font-medium text-amber-200">
              <AlertTriangle className="w-3 h-3" />
              {needsAttention} needs attention
            </span>
          )}
        </h1>
        <p className="text-sm text-neutral-400 mt-1">
          Read-only view of ad performance. No edits from this screen.
        </p>
      </div>

      {/* Header / Filter bar */}
      <div className="flex flex-wrap items-center gap-4">
        <select
          value={range}
          onChange={(e) => setRange(e.target.value as DateRangePreset)}
          className="rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200"
        >
          {RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => fetchData({ skipCache: true })}
          disabled={loading}
          className="flex items-center gap-2 rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
        {data?.lastFetchedAt && (
          <span className="text-xs text-neutral-500">
            {data.cacheHit ? "Cached · " : ""}Synced: {new Date(data.lastFetchedAt).toLocaleString()}
          </span>
        )}
        {data?.accountId && (
          <span className="text-xs text-neutral-500">{data.accountId}</span>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-4">
          <p className="text-sm text-red-200">{error}</p>
          <p className="text-xs text-neutral-500 mt-1">
            See docs/META_ADS_MONITOR_SETUP.md for setup and troubleshooting.
          </p>
        </div>
      )}

      {/* Loading state */}
      {loading && !data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-20 rounded-lg bg-neutral-800 animate-pulse" />
            ))}
          </div>
          <div className="h-64 rounded-lg bg-neutral-800 animate-pulse" />
        </div>
      )}

      {/* No account / No data */}
      {!loading && !error && !data?.ok && (
        <div className="rounded-lg border border-neutral-800 p-8 text-center text-neutral-500">
          No data. Configure META_ACCESS_TOKEN and META_AD_ACCOUNT_ID.
        </div>
      )}

      {/* Content */}
      {!loading && data?.ok && (
        <div className="space-y-6">
          <MetaAdsKpiCards summary={data.summary} />
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <MetaAdsCampaignTable campaigns={data.campaigns} />
              <MetaAdsAdSetTable adsets={data.adsets} />
              <MetaAdsAdTable ads={data.ads} />
            </div>
            <div>
              <MetaAdsInsightsPanel insights={data.insights} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
