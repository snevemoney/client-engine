"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Calculator, RefreshCw } from "lucide-react";
import {
  ScoreBadge,
  ScoreCard,
  ScoreReasonsList,
  ScoreFactorsTable,
  ScoreEventsList,
} from "@/components/scores";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const STORAGE_KEY = "qa-scores-selection";

const ENTITY_TYPES = [
  { value: "review_stream", label: "Reviews" },
  { value: "command_center", label: "Command Center" },
] as const;

function getDefaultEntityId(entityType: string): string {
  if (entityType === "command_center") return "command_center";
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - (day === 0 ? 6 : day - 1);
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

function loadSelection(): { entityType: string; entityId: string } {
  if (typeof window === "undefined") {
    return {
      entityType: "command_center",
      entityId: "command_center",
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { entityType?: string; entityId?: string };
      if (parsed.entityType && parsed.entityId) {
        return { entityType: parsed.entityType, entityId: parsed.entityId };
      }
    }
  } catch {
    /* ignore */
  }
  return {
    entityType: "command_center",
    entityId: "command_center",
  };
}

function saveSelection(entityType: string, entityId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ entityType, entityId }));
  } catch {
    /* ignore */
  }
}

export default function ScoresQAPage() {
  const { confirm, dialogProps } = useConfirmDialog();
  const [entityType, setEntityType] = useState("command_center");
  const [entityId, setEntityId] = useState("command_center");
  const [latest, setLatest] = useState<{
    id: string;
    score: number;
    band: string;
    delta: number | null;
    factorsJson: unknown;
    reasonsJson: unknown;
    computedAt: string;
  } | null>(null);
  const [previous, setPrevious] = useState<{
    id: string;
    score: number;
    band: string;
    computedAt: string;
  } | null>(null);
  const [recentEvents, setRecentEvents] = useState<
    Array<{
      id: string;
      eventType: string;
      fromScore: number;
      toScore: number;
      delta: number;
      fromBand: string;
      toBand: string;
      createdAt: string;
    }>
  >([]);
  const [history, setHistory] = useState<{
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
  } | null>(null);
  const [computing, setComputing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [computeError, setComputeError] = useState<string | null>(null);

  useEffect(() => {
    const s = loadSelection();
    setEntityType(s.entityType);
    setEntityId(s.entityId);
  }, []);

  useEffect(() => {
    saveSelection(entityType, entityId);
  }, [entityType, entityId]);

  const fetchLatest = useCallback(async () => {
    if (!entityType || !entityId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/internal/scores/latest?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`,
        { credentials: "include", cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        setLatest(data.latest);
        setPrevious(data.previous);
        setRecentEvents(data.recentEvents ?? []);
      } else {
        setLatest(null);
        setPrevious(null);
        setRecentEvents([]);
      }
    } catch {
      setLatest(null);
      setPrevious(null);
      setRecentEvents([]);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  const fetchHistory = useCallback(async () => {
    if (!entityType || !entityId) return;
    try {
      const res = await fetch(
        `/api/internal/scores/history?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}&range=7d`,
        { credentials: "include", cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      } else {
        setHistory(null);
      }
    } catch {
      setHistory(null);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    void fetchLatest();
  }, [fetchLatest]);

  const handleCompute = async () => {
    setComputing(true);
    setComputeError(null);
    try {
      const res = await fetch("/api/internal/scores/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ entityType, entityId }),
      });
      if (res.ok) {
        await fetchLatest();
        await fetchHistory();
      } else {
        const err = await res.json().catch(() => null);
        setComputeError(err?.error ?? "Compute failed");
      }
    } catch (e) {
      setComputeError(e instanceof Error ? e.message : "Compute failed");
    } finally {
      setComputing(false);
    }
  };

  const factors = (latest?.factorsJson as Array<{ key: string; label: string; weight: number; normalizedValue: number; impact: number; reason?: string }>) ?? [];
  const reasons = ((latest?.reasonsJson as Array<{ label: string; impact: number; direction: string }>) ?? []).sort(
    (a, b) => a.impact - b.impact
  );

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Score QA</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Inspect scores and manually trigger recompute. State persists in localStorage.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/internal/scoreboard">
          <Button variant="outline" size="sm">Operational Score</Button>
        </Link>
        <Link href="/dashboard/internal/qa/notifications">
          <Button variant="outline" size="sm">Notifications QA</Button>
        </Link>
      </div>

      {computeError && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-400" role="alert">
          {computeError}
        </div>
      )}

      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 space-y-4">
        <h2 className="text-sm font-medium text-neutral-300">Entity</h2>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Entity type</label>
            <select
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value);
                setEntityId(getDefaultEntityId(e.target.value));
              }}
              className="rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm"
            >
              {ENTITY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Entity ID</label>
            <input
              type="text"
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              placeholder={entityType === "command_center" ? "command_center" : "YYYY-MM-DD"}
              className="rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm w-48"
            />
          </div>
          <div className="flex items-end gap-2">
            <Button
              size="sm"
              onClick={() => void fetchLatest()}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={async () => {
                const ok = await confirm({
                  title: "Recompute score?",
                  body: `This will recompute the score for ${entityType} / ${entityId}.`,
                  confirmLabel: "Compute",
                });
                if (ok) void handleCompute();
              }}
              disabled={computing}
            >
              <Calculator className="w-4 h-4 mr-1" />
              {computing ? "Computing…" : "Compute score now"}
            </Button>
          </div>
        </div>
      </div>

      {latest && (
        <>
          <ScoreCard
            score={latest.score}
            band={latest.band}
            delta={latest.delta}
            computedAt={latest.computedAt}
          />
          <ScoreReasonsList reasons={reasons} />
          <ScoreFactorsTable factors={factors} />
          <ScoreEventsList events={recentEvents} />
        </>
      )}

      {history && history.timeline.length > 0 && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-neutral-300 mb-3">Timeline (7d)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-500">
                  <th className="pb-2">Computed at</th>
                  <th className="pb-2">Score</th>
                  <th className="pb-2">Band</th>
                  <th className="pb-2">Delta</th>
                </tr>
              </thead>
              <tbody>
                {history.timeline.map((s) => (
                  <tr key={s.id} className="border-t border-neutral-800">
                    <td className="py-1">{new Date(s.computedAt).toLocaleString("en-US")}</td>
                    <td>{s.score.toFixed(1)}</td>
                    <td><ScoreBadge band={s.band} /></td>
                    <td>{s.delta != null ? `${s.delta >= 0 ? "+" : ""}${s.delta.toFixed(1)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !latest && (
        <p className="text-sm text-neutral-500">No score data. Click &quot;Compute score now&quot; to create one.</p>
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
