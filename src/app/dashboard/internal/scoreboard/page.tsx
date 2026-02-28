"use client";

/**
 * Phase 3.2 + 3.3: Operational Score Visibility — scoreboard, trends, factor drilldown.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Calculator, RefreshCw } from "lucide-react";
import {
  ScoreCard,
  ScoreReasonsList,
  ScoreFactorsTable,
  ScoreEventsList,
  ScoreTrendChart,
  TrendSummaryBlock,
  ScoreFactorChanges,
  DataFreshnessIndicator,
  AlertsSummaryChip,
} from "@/components/scores";
import {
  computeTrendSummary,
  computeFactorChanges,
  type FactorItem,
} from "@/lib/scores/trend-utils";

const ENTITY = { entityType: "command_center", entityId: "command_center" };

const RANGES = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
] as const;

type SummaryData = {
  latest: {
    id: string;
    score: number;
    band: string;
    delta: number | null;
    computedAt: string;
    topReasons: Array<{ label: string; impact: number; direction: string }>;
    factorSummary: FactorItem[];
  } | null;
  previous: { id: string; score: number; band: string; computedAt: string } | null;
  previousFactorSummary: FactorItem[] | null;
  recentEvents: Array<{
    id: string;
    eventType: string;
    fromScore: number;
    toScore: number;
    delta: number;
    fromBand: string;
    toBand: string;
    createdAt: string;
  }>;
};

type HistoryData = {
  timeline: Array<{ id: string; score: number; band: string; delta: number | null; computedAt: string }>;
  events: Array<{
    id: string;
    eventType: string;
    fromScore: number;
    toScore: number;
    delta: number;
    fromBand: string;
    toBand: string;
    createdAt: string;
  }>;
};

export default function InternalScoreboardPage() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [range, setRange] = useState<(typeof RANGES)[number]["value"]>("7d");
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const { confirm: confirmRecomputeAction, dialogProps: recomputeDialogProps } = useConfirmDialog();

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/internal/scores/summary?entityType=${encodeURIComponent(ENTITY.entityType)}&entityId=${encodeURIComponent(ENTITY.entityId)}`,
        { credentials: "include", cache: "no-store" }
      );
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        const err = await res.json().catch(() => null);
        setError(err?.error ?? "Failed to load");
        setData(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(
        `/api/internal/scores/history?entityType=${encodeURIComponent(ENTITY.entityType)}&entityId=${encodeURIComponent(ENTITY.entityId)}&range=${range}`,
        { credentials: "include", cache: "no-store" }
      );
      if (res.ok) {
        const json = await res.json();
        setHistory(json);
      } else {
        setHistory(null);
      }
    } catch {
      setHistory(null);
    } finally {
      setHistoryLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  const handleRecompute = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setComputing(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/internal/scores/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(ENTITY),
      });
      if (res.ok) {
        await Promise.all([fetchSummary(), fetchHistory()]);
        setSuccess("Score recomputed successfully");
        setTimeout(() => setSuccess(null), 4000);
      } else {
        const err = await res.json().catch(() => null);
        setError(err?.error ?? "Compute failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Compute failed");
    } finally {
      setComputing(false);
      inFlightRef.current = false;
    }
  };

  const handleRefresh = () => {
    void fetchSummary();
    void fetchHistory();
  };

  const factorChanges =
    data?.latest?.factorSummary && data.previousFactorSummary
      ? computeFactorChanges(data.latest.factorSummary, data.previousFactorSummary)
      : [];

  const trendSummary =
    data?.latest && history
      ? computeTrendSummary(
          history.timeline.map((t) => ({ score: t.score, computedAt: t.computedAt })),
          history.events,
          data.latest.score
        )
      : null;

  const rangeLabel = RANGES.find((r) => r.value === range)?.label ?? "7d";

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Operational Score</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Command Center health score — trends, reasons, factor breakdown, and recent events.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {data?.latest && (
            <DataFreshnessIndicator computedAt={data.latest.computedAt} />
          )}
          <AlertsSummaryChip />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={loading}
          aria-label="Refresh score data"
        >
          <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        <Button
          size="sm"
          onClick={async () => {
            const ok = await confirmRecomputeAction({ title: "Recompute score", body: "This will recompute the operational score. Continue?", confirmLabel: "Recompute" });
            if (ok) void handleRecompute();
          }}
          disabled={computing}
          aria-label="Recompute score now"
          data-testid="recompute-button"
        >
          <Calculator className="w-4 h-4 mr-1.5" />
          {computing ? "Computing…" : "Recompute now"}
        </Button>
        <div className="flex gap-1" role="group" aria-label="Trend range">
          {RANGES.map((r) => (
            <Button
              key={r.value}
              variant={range === r.value ? "default" : "outline"}
              size="sm"
              onClick={() => setRange(r.value)}
              data-testid={`range-${r.value}`}
            >
              {r.label}
            </Button>
          ))}
        </div>
        <Link href="/dashboard/internal/scores/alerts">
          <Button variant="ghost" size="sm" data-testid="alerts-prefs-link">
            Alert preferences
          </Button>
        </Link>
        <Link href="/dashboard/internal/qa/scores">
          <Button variant="ghost" size="sm">QA: Multi-entity</Button>
        </Link>
      </div>

      {error && (
        <div
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-400"
          data-testid="score-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400"
          data-testid="score-success"
          role="status"
        >
          {success}
        </div>
      )}

      {loading && !data && (
        <p className="text-sm text-neutral-500">Loading…</p>
      )}

      {!loading && data?.latest && (
        <>
          <ScoreCard
            score={data.latest.score}
            band={data.latest.band}
            delta={data.latest.delta}
            computedAt={data.latest.computedAt}
          />

          <section aria-label="Score trend" data-testid="trend-section">
            {trendSummary && (
              <div className="mb-4">
                <TrendSummaryBlock summary={trendSummary} rangeLabel={rangeLabel} />
              </div>
            )}
            {historyLoading ? (
              <p className="text-sm text-neutral-500">Loading chart…</p>
            ) : (
              <ScoreTrendChart
                timeline={
                  history?.timeline.map((t) => ({ score: t.score, computedAt: t.computedAt })) ?? []
                }
                rangeLabel={rangeLabel}
              />
            )}
          </section>

          <ScoreFactorChanges changes={factorChanges} />
          <ScoreReasonsList reasons={data.latest.topReasons} />
          <ScoreFactorsTable factors={data.latest.factorSummary} />
          <ScoreEventsList events={data.recentEvents} />
        </>
      )}

      {!loading && !data?.latest && !error && (
        <div
          className="rounded-lg border border-dashed border-neutral-700 bg-neutral-900/30 p-8 text-center"
          data-testid="score-empty-state"
        >
          <p className="text-neutral-400 mb-4">No score data yet.</p>
          <Button
            onClick={async () => {
              const ok = await confirmRecomputeAction({ title: "Recompute score", body: "This will recompute the operational score. Continue?", confirmLabel: "Recompute" });
              if (ok) void handleRecompute();
            }}
            disabled={computing}
            data-testid="recompute-empty-cta"
          >
            <Calculator className="w-4 h-4 mr-2" />
            Compute score now
          </Button>
        </div>
      )}

      <ConfirmDialog {...recomputeDialogProps} />
    </div>
  );
}
