"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { RefreshCw, Megaphone, AlertTriangle, Heart, LayoutDashboard, Zap, History, Settings } from "lucide-react";
import type { MetaAdsDashboardData, MetaAdsDashboardError, DateRangePreset } from "@/lib/meta-ads/types";
import { MetaAdsKpiCards } from "./MetaAdsKpiCards";
import { MetaAdsCampaignTable } from "./MetaAdsCampaignTable";
import { MetaAdsAdSetTable } from "./MetaAdsAdSetTable";
import { MetaAdsAdTable } from "./MetaAdsAdTable";
import { MetaAdsInsightsPanel } from "./MetaAdsInsightsPanel";
import { MetaAdsDataStatusStrip } from "./MetaAdsDataStatusStrip";
import { MetaAdsEmptyState } from "./MetaAdsEmptyState";
import { MetaAdsRecommendationsPanel } from "./MetaAdsRecommendationsPanel";
import { MetaAdsActionHistoryPanel } from "./MetaAdsActionHistoryPanel";
import { MetaAdsSettingsPanel } from "./MetaAdsSettingsPanel";
import { MetaAdsExplainabilityCard } from "./MetaAdsExplainabilityCard";

const RANGES: { value: DateRangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last_7d", label: "7d" },
  { value: "last_14d", label: "14d" },
  { value: "last_30d", label: "30d" },
];

const RANGE_LABELS: Record<DateRangePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last_7d: "7d",
  last_14d: "14d",
  last_30d: "30d",
};

function errorMessage(err: MetaAdsDashboardError): { message: string; docHint: string } {
  const base = "See docs/META_ADS_MONITOR_SETUP.md for setup and troubleshooting.";
  switch (err.code) {
    case "NO_TOKEN":
      return {
        message: "META_ACCESS_TOKEN not configured.",
        docHint: "Connect your Meta Ads account in Settings → Connections to see ad data here.",
      };
    case "INVALID_TOKEN":
      return {
        message: "Invalid or expired token.",
        docHint: "Generate a new token in Graph API Explorer or Business Settings → System Users. Ensure ads_read is included.",
      };
    case "PERMISSION_DENIED":
      return {
        message: "Permission denied.",
        docHint: "Your token needs ads_read. Re-generate with ads_read in Graph API Explorer or System User settings.",
      };
    case "RATE_LIMIT":
      return {
        message: "Rate limit hit.",
        docHint: "Wait 5–10 minutes before refreshing. Use cache (don’t force refresh) when checking frequently.",
      };
    default:
      return {
        message: err.error ?? "Failed to load.",
        docHint: base,
      };
  }
}

type Tab = "overview" | "recommendations" | "actions" | "settings";

export function MetaAdsPageClient() {
  const [range, setRange] = useState<DateRangePreset>("last_7d");
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<MetaAdsDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetchWasFresh, setLastFetchWasFresh] = useState(false);
  const [settingsSummary, setSettingsSummary] = useState<{ mode: string; dryRun: boolean; targetCpl: number | null; minSpend: number; minImpressions: number } | null>(null);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);
  const [metaMode, setMetaMode] = useState<"mock" | "live" | null>(null);
  const [metaMockScenario, setMetaMockScenario] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/meta-ads/mode")
      .then((r) => r.json())
      .then((j) => {
        setMetaMode(j.mode ?? null);
        setMetaMockScenario(j.scenario ?? null);
      })
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async (opts?: { skipCache?: boolean }) => {
    setLoading(true);
    setError(null);
    setLastFetchWasFresh(false);
    try {
      const skipCache = opts?.skipCache ? "&skipCache=1" : "";
      const res = await fetch(`/api/meta-ads/dashboard?range=${range}${skipCache}`);
      const json = (await res.json()) as MetaAdsDashboardData | MetaAdsDashboardError;
      if (!json.ok) {
        const err = json as MetaAdsDashboardError;
        const { message, docHint } = errorMessage(err);
        setError(`${message} ${docHint}`);
        setData(null);
      } else {
        const d = json as MetaAdsDashboardData;
        setData(d);
        if (d.metaMode) setMetaMode(d.metaMode);
        if (d.metaMockScenario) setMetaMockScenario(d.metaMockScenario);
        if (opts?.skipCache) {
          setLastFetchWasFresh(true);
          setTimeout(() => setLastFetchWasFresh(false), 4000);
        }
      }
    } catch (e) {
      setError(`${e instanceof Error ? e.message : "Network error"} See docs/META_ADS_MONITOR_SETUP.md for setup and troubleshooting.`);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (tab === "recommendations" || tab === "settings") {
      fetch("/api/meta-ads/settings")
        .then((r) => r.json())
        .then((j) => {
          const s = j.settings;
          if (s) setSettingsSummary({ mode: s.mode ?? "manual", dryRun: s.dryRun ?? true, targetCpl: s.targetCpl ?? null, minSpend: s.minSpendForDecision ?? 20, minImpressions: s.minImpressionsForDecision ?? 100 });
        });
    }
  }, [tab]);

  const needsAttention = data?.insights?.filter((i) => i.severity === "warn" || i.severity === "critical").length ?? 0;
  const isEmpty = data?.ok && data.campaigns.length === 0;
  const cacheState = loading ? "loading" : data?.cacheHit ? "cached" : "fresh";

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2 flex-wrap">
          <Megaphone className="w-6 h-6 text-neutral-400" />
          Meta Ads Monitor
          {metaMode && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                metaMode === "mock"
                  ? "bg-amber-900/50 text-amber-200"
                  : "bg-emerald-900/50 text-emerald-200"
              }`}
              title={metaMode === "mock" ? `Scenario: ${metaMockScenario ?? "healthy_campaigns"}` : undefined}
            >
              {metaMode === "mock" ? "Mock mode" : "Live mode"}
              {metaMode === "mock" && metaMockScenario && (
                <span className="text-amber-400/90"> ({metaMockScenario})</span>
              )}
            </span>
          )}
          {needsAttention > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-900/50 px-2 py-0.5 text-xs font-medium text-amber-200">
              <AlertTriangle className="w-3 h-3" />
              {needsAttention} needs attention
            </span>
          )}
        </h1>
        <p className="text-sm text-neutral-400 mt-1">
          Monitor performance and pause/resume campaigns, ad sets, and ads.
        </p>
        <Link
          href="/dashboard/meta-ads/health"
          className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 mt-2"
        >
          <Heart className="w-3.5 h-3.5" />
          Asset health
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-neutral-800 pb-2">
        {[
          { id: "overview" as Tab, label: "Overview", icon: LayoutDashboard },
          { id: "recommendations" as Tab, label: "Recommendations", icon: Zap },
          { id: "actions" as Tab, label: "Action History", icon: History },
          { id: "settings" as Tab, label: "Settings", icon: Settings },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded text-sm ${tab === t.id ? "bg-neutral-800 text-neutral-100" : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"}`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
      <MetaAdsDataStatusStrip
        status={error ? "error" : loading && !data ? "loading" : "connected"}
        accountId={data?.accountId ?? null}
        range={RANGE_LABELS[range]}
        cacheState={lastFetchWasFresh ? "fresh" : cacheState}
        lastSyncedAt={data?.lastFetchedAt ?? null}
      />
      )}

      {tab === "overview" && (
      <>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-4">
        <select
          value={range}
          onChange={(e) => setRange(e.target.value as DateRangePreset)}
          disabled={loading}
          className="rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 disabled:opacity-50"
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
          className="flex items-center gap-2 rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Loading…" : "Refresh"}
        </button>
        {!loading && data?.ok && (
          <span className={`text-xs ${lastFetchWasFresh ? "text-emerald-400" : "text-neutral-500"}`}>
            {lastFetchWasFresh ? "Fresh fetch" : data.cacheHit ? "Cached" : "Live"}
          </span>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-4">
          <p className="text-sm text-red-200">{error}</p>
          <p className="text-xs text-neutral-500 mt-1">
            docs/META_ADS_MONITOR_SETUP.md · docs/META_ADS_MONITOR_RUNBOOK.md
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
          No data yet. Connect your Meta Ads account in Settings → Connections.
        </div>
      )}

      {/* Content */}
      {!loading && data?.ok && (
        <div className="space-y-6">
          <MetaAdsKpiCards summary={data.summary} />
          {isEmpty ? (
            <MetaAdsEmptyState accountId={data.accountId} range={RANGE_LABELS[range]} />
          ) : (
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <MetaAdsCampaignTable campaigns={data.campaigns} onRefresh={() => fetchData({ skipCache: true })} />
                <MetaAdsAdSetTable adsets={data.adsets} onRefresh={() => fetchData({ skipCache: true })} />
                <MetaAdsAdTable ads={data.ads} onRefresh={() => fetchData({ skipCache: true })} />
              </div>
              <div>
                <MetaAdsInsightsPanel insights={data.insights} />
              </div>
            </div>
          )}
        </div>
      )}
      </>
      )}

      {tab === "recommendations" && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <MetaAdsRecommendationsPanel
              onRefresh={() => fetchData({ skipCache: true })}
              onData={(d) => setLastGenerated(d.lastGenerated)}
            />
          </div>
          <div>
            <MetaAdsExplainabilityCard
              mode={settingsSummary?.mode ?? "manual"}
              dryRun={settingsSummary?.dryRun ?? true}
              targetCpl={settingsSummary?.targetCpl ?? null}
              minSpend={settingsSummary?.minSpend ?? 20}
              minImpressions={settingsSummary?.minImpressions ?? 100}
              lastGenerated={lastGenerated}
            />
          </div>
        </div>
      )}

      {tab === "actions" && <MetaAdsActionHistoryPanel />}

      {tab === "settings" && <MetaAdsSettingsPanel />}
    </div>
  );
}
