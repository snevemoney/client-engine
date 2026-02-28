"use client";

import { useState, useEffect, useCallback, use, useRef } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { AsyncState } from "@/components/ui/AsyncState";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { fetchJsonThrow } from "@/lib/http/fetch-json";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type WeekData = {
  week: {
    id: string | null;
    weekStart: string;
    weekEnd: string;
    quarterId: string | null;
    focusConstraint: string | null;
    createdAt?: string;
    updatedAt?: string;
  };
  plan: {
    topOutcomes: Array<string | { title?: string; why?: string }>;
    milestones: Array<string | { title?: string; measurable?: string }>;
    commitments: Array<string | unknown>;
  };
  review: {
    wins: Array<string | unknown>;
    misses: Array<string | unknown>;
    deltas: Array<string | unknown>;
    decisions: Array<string | unknown>;
    retroNotes: string | null;
  };
};

type Suggestions = {
  topOutcomes: Array<{ title: string; why: string; sources?: unknown[] }>;
  milestones: Array<{ title: string; measurable: string; sources?: unknown[] }>;
  focusConstraint: string | null;
};

function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${start.toLocaleDateString("en-CA", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}`;
}

function toStr(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "title" in v) return String((v as { title?: string }).title ?? "");
  return String(v ?? "");
}

const toastFn = (m: string, t?: "success" | "error") => t === "error" ? toast.error(m) : toast.success(m);

export default function FounderOSWeekPage({ searchParams }: { searchParams: Promise<{ weekStart?: string; preview?: string; generate?: string }> }) {
  const params = use(searchParams);
  const [data, setData] = useState<WeekData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Suggestions | null>(null);
  const [focusConstraint, setFocusConstraint] = useState("");
  const [topOutcomes, setTopOutcomes] = useState<string[]>([]);
  const [milestones, setMilestones] = useState<string[]>([]);
  const [commitments, setCommitments] = useState<string[]>([]);
  const [wins, setWins] = useState<string[]>([]);
  const [misses, setMisses] = useState<string[]>([]);
  const [deltas, setDeltas] = useState<string[]>([]);
  const [decisions, setDecisions] = useState<string[]>([]);
  const [retroNotes, setRetroNotes] = useState("");
  const [memorySummary, setMemorySummary] = useState<{
    topRecurringRuleKeys: Array<{ ruleKey: string; count: number; trend: number }>;
    topDismissedRuleKeys: Array<{ ruleKey: string; count: number }>;
    suggestedSuppressions: Array<{ ruleKey: string; dismissRate: number; dismissCount: number }>;
    trendDiffs?: {
      recurring: Array<{ ruleKey: string; currentCount: number; priorCount: number; delta: number; direction: string }>;
      dismissed: Array<{ ruleKey: string; currentCount: number; priorCount: number; delta: number; direction: string }>;
      successful: Array<{ ruleKey: string; currentCount: number; priorCount: number; delta: number; direction: string }>;
    };
    patternAlerts?: Array<{
      ruleKey: string;
      severity: string;
      title: string;
      description: string;
      riskFlagExists: boolean;
    }>;
    policySuggestions?: Array<{
      type: string;
      ruleKey: string;
      confidence: number;
      reasons: string[];
      evidence: Array<{ key: string; value: unknown }>;
    }>;
    topEffectiveRuleKeys?: Array<{
      ruleKey: string;
      executions: number;
      avgRiskOpenDelta: number;
      avgRiskCriticalDelta: number;
      avgScoreDelta: number | null;
      netLiftScore: number;
    }>;
    topNoisyRuleKeys?: Array<{
      ruleKey: string;
      executions: number;
      dismissCount?: number;
      netLiftScore: number;
    }>;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { confirm, dialogProps } = useConfirmDialog();

  const weekStart = params.weekStart ?? "";

  const fetchWeek = useCallback(async (signal?: AbortSignal) => {
    const url = weekStart
      ? `/api/internal/founder/os/week?weekStart=${encodeURIComponent(weekStart)}`
      : "/api/internal/founder/os/week";
    setError(null);
    try {
      const res = await fetch(url, { credentials: "include", cache: "no-store", signal });
      if (signal?.aborted) return;
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? `Failed to load (${res.status})`);
        return;
      }
      setData(json);
      setFocusConstraint(json.week?.focusConstraint ?? "");
      setTopOutcomes((json.plan?.topOutcomes ?? []).map(toStr).filter(Boolean));
      setMilestones((json.plan?.milestones ?? []).map((m: unknown) => toStr(m)).filter(Boolean));
      setCommitments((json.plan?.commitments ?? []).map(toStr).filter(Boolean));
      setWins((json.review?.wins ?? []).map(toStr).filter(Boolean));
      setMisses((json.review?.misses ?? []).map(toStr).filter(Boolean));
      setDeltas((json.review?.deltas ?? []).map(toStr).filter(Boolean));
      setDecisions((json.review?.decisions ?? []).map(toStr).filter(Boolean));
      setRetroNotes(json.review?.retroNotes ?? "");
    } catch (e) {
      if (e instanceof Error && (e.name === "AbortError" || e.message?.includes("aborted"))) return;
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [weekStart]);

  const fetchMemorySummary = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/internal/memory/summary?range=7d", { credentials: "include", cache: "no-store", signal });
      if (signal?.aborted) return;
      const d = await res.json();
      if (
        d.topRecurringRuleKeys ||
        d.suggestedSuppressions ||
        d.trendDiffs ||
        d.patternAlerts ||
        d.topEffectiveRuleKeys ||
        d.topNoisyRuleKeys
      )
        setMemorySummary(d);
    } catch {
      // Memory summary is supplementary — silent failure is acceptable
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    if (params.preview) {
      try {
        const p = JSON.parse(decodeURIComponent(params.preview)) as Suggestions;
        setPreview(p);
        if (p.topOutcomes?.length) setTopOutcomes(p.topOutcomes.map((o) => o.title));
        if (p.milestones?.length) setMilestones(p.milestones.map((m) => m.title));
        if (p.focusConstraint) setFocusConstraint(p.focusConstraint);
      } catch {
        setPreview(null);
      }
    }
    fetchWeek(controller.signal).finally(() => setLoading(false));
    void fetchMemorySummary(controller.signal);
    return () => { controller.abort(); };
  }, [params.preview, fetchWeek, fetchMemorySummary]);

  useEffect(() => {
    if (params.generate !== "1") return;
    const controller = new AbortController();
    fetch("/api/internal/founder/os/week/suggest", { method: "POST", credentials: "include", signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        if (d.topOutcomes || d.milestones) setPreview(d);
      })
      .catch((e) => {
        if (e instanceof Error && (e.name === "AbortError" || e.message?.includes("aborted"))) return;
        toast.error("Failed to generate suggestions");
      });
    return () => { controller.abort(); };
  }, [params.generate]);

  const generateSuggestionsAction = useAsyncAction(
    async () => {
      const json = await fetchJsonThrow<Suggestions>("/api/internal/founder/os/week/suggest", { method: "POST" });
      setPreview(json);
    },
    { toast: toastFn, successMessage: "Suggestions generated" }
  );

  function applySuggestions() {
    if (!preview) return;
    setTopOutcomes(preview.topOutcomes.map((o) => o.title));
    setMilestones(preview.milestones.map((m) => m.title));
    if (preview.focusConstraint) setFocusConstraint(preview.focusConstraint);
    setPreview(null);
  }

  const runPolicyEngineAction = useAsyncAction(
    async () => {
      await fetchJsonThrow("/api/internal/memory/run", { method: "POST" });
      void fetchMemorySummary();
    },
    { toast: toastFn, successMessage: "Policy engine executed" }
  );

  const applySuppressionAction = useAsyncAction(
    async (ruleKey: string) => {
      const ok = await confirm({ title: `Suppress "${ruleKey}" for 30 days?`, body: "This rule will stop generating suggestions during the suppression period.", variant: "destructive" });
      if (!ok) return;
      await fetchJsonThrow("/api/internal/memory/apply", {
        method: "POST",
        body: JSON.stringify({ type: "suppression_30d", ruleKey }),
      });
      setMemorySummary((prev) =>
        prev
          ? {
              ...prev,
              suggestedSuppressions: prev.suggestedSuppressions.filter((s) => s.ruleKey !== ruleKey),
              policySuggestions: (prev.policySuggestions ?? []).filter((s) => s.ruleKey !== ruleKey),
            }
          : null
      );
    },
    { toast: toastFn, successMessage: "Rule suppressed for 30 days" }
  );

  const saveAction = useAsyncAction(
    async () => {
      const url = weekStart
        ? `/api/internal/founder/os/week?weekStart=${encodeURIComponent(weekStart)}`
        : "/api/internal/founder/os/week";
      const json = await fetchJsonThrow<WeekData>(url, {
        method: "PUT",
        body: JSON.stringify({
          focusConstraint: focusConstraint || null,
          plan: {
            topOutcomes: topOutcomes.filter(Boolean),
            milestones: milestones.filter(Boolean),
            commitments: commitments.filter(Boolean),
          },
          review: {
            wins: wins.filter(Boolean),
            misses: misses.filter(Boolean),
            deltas: deltas.filter(Boolean),
            decisions: decisions.filter(Boolean),
            retroNotes: retroNotes || null,
          },
        }),
      });
      setData(json);
    },
    { toast: toastFn, successMessage: "Saved" }
  );

  const weekLabel = data?.week?.weekStart ? formatWeekRange(data.week.weekStart) : "This week";

  return (
    <div className="space-y-6" data-testid="founder-os-week">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Week: {weekLabel}</h1>
        <p className="text-sm text-neutral-400 mt-1">Plan and review.</p>
      </div>

      <AsyncState loading={loading} error={error} onRetry={() => { setLoading(true); fetchWeek().finally(() => setLoading(false)); }}>
        {preview && (
          <div className="rounded-lg border border-amber-500/50 bg-amber-950/30 p-4">
            <h2 className="text-sm font-medium text-amber-400/90 mb-2">Suggestions preview</h2>
            <p className="text-xs text-neutral-400 mb-2">
              Review and apply, or edit before saving.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={applySuggestions}
                className="text-xs px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-black"
              >
                Apply suggestions
              </button>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="text-xs px-2 py-1 rounded border border-neutral-600 hover:bg-neutral-800"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void generateSuggestionsAction.execute()}
            disabled={generateSuggestionsAction.pending}
            data-testid="founder-os-week-generate-suggestions"
            className="text-xs px-2 py-1 rounded border border-neutral-600 hover:bg-neutral-800 text-amber-400 disabled:opacity-50"
          >
            {generateSuggestionsAction.pending ? "Generating…" : "Generate suggestions"}
          </button>
          <button
            type="button"
            onClick={() => void saveAction.execute()}
            disabled={saveAction.pending}
            className="text-xs px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-black disabled:opacity-50"
          >
            {saveAction.pending ? "Saving…" : "Save"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Plan */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
            <h2 className="text-sm font-medium text-amber-400/90 mb-3">Plan</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-neutral-500 block mb-1">Focus constraint</label>
                <input
                  type="text"
                  value={focusConstraint}
                  onChange={(e) => setFocusConstraint(e.target.value)}
                  placeholder="e.g. follow_up_gap"
                  className="w-full px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500 block mb-1">Top outcomes (3)</label>
                {[0, 1, 2].map((i) => (
                  <input
                    key={i}
                    type="text"
                    value={topOutcomes[i] ?? ""}
                    onChange={(e) => {
                      const next = [...topOutcomes];
                      next[i] = e.target.value;
                      setTopOutcomes(next);
                    }}
                    placeholder={`Outcome ${i + 1}`}
                    className="w-full px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-sm mt-1"
                  />
                ))}
              </div>
              <div>
                <label className="text-xs text-neutral-500 block mb-1">Milestones</label>
                {milestones.map((m, i) => (
                  <input
                    key={i}
                    type="text"
                    value={m}
                    onChange={(e) => {
                      const next = [...milestones];
                      next[i] = e.target.value;
                      setMilestones(next);
                    }}
                    className="w-full px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-sm mt-1"
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setMilestones([...milestones, ""])}
                  className="text-xs text-amber-400 mt-2"
                >
                  + Add milestone
                </button>
              </div>
              <div>
                <label className="text-xs text-neutral-500 block mb-1">Commitments</label>
                {commitments.map((c, i) => (
                  <input
                    key={i}
                    type="text"
                    value={c}
                    onChange={(e) => {
                      const next = [...commitments];
                      next[i] = e.target.value;
                      setCommitments(next);
                    }}
                    className="w-full px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-sm mt-1"
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setCommitments([...commitments, ""])}
                  className="text-xs text-amber-400 mt-2"
                >
                  + Add commitment
                </button>
              </div>
            </div>
          </div>

          {/* Review */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
            <h2 className="text-sm font-medium text-amber-400/90 mb-3">Review</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-neutral-500 block mb-1">Wins</label>
                {wins.map((w, i) => (
                  <input
                    key={i}
                    type="text"
                    value={w}
                    onChange={(e) => {
                      const next = [...wins];
                      next[i] = e.target.value;
                      setWins(next);
                    }}
                    className="w-full px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-sm mt-1"
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setWins([...wins, ""])}
                  className="text-xs text-amber-400 mt-2"
                >
                  + Add win
                </button>
              </div>
              <div>
                <label className="text-xs text-neutral-500 block mb-1">Misses</label>
                {misses.map((m, i) => (
                  <input
                    key={i}
                    type="text"
                    value={m}
                    onChange={(e) => {
                      const next = [...misses];
                      next[i] = e.target.value;
                      setMisses(next);
                    }}
                    className="w-full px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-sm mt-1"
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setMisses([...misses, ""])}
                  className="text-xs text-amber-400 mt-2"
                >
                  + Add miss
                </button>
              </div>
              <div>
                <label className="text-xs text-neutral-500 block mb-1">Deltas</label>
                {deltas.map((d, i) => (
                  <input
                    key={i}
                    type="text"
                    value={d}
                    onChange={(e) => {
                      const next = [...deltas];
                      next[i] = e.target.value;
                      setDeltas(next);
                    }}
                    className="w-full px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-sm mt-1"
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setDeltas([...deltas, ""])}
                  className="text-xs text-amber-400 mt-2"
                >
                  + Add delta
                </button>
              </div>
              <div>
                <label className="text-xs text-neutral-500 block mb-1">Decisions</label>
                {decisions.map((d, i) => (
                  <input
                    key={i}
                    type="text"
                    value={d}
                    onChange={(e) => {
                      const next = [...decisions];
                      next[i] = e.target.value;
                      setDecisions(next);
                    }}
                    className="w-full px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-sm mt-1"
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setDecisions([...decisions, ""])}
                  className="text-xs text-amber-400 mt-2"
                >
                  + Add decision
                </button>
              </div>
              <div>
                <label className="text-xs text-neutral-500 block mb-1">Retro notes</label>
                <textarea
                  value={retroNotes}
                  onChange={(e) => setRetroNotes(e.target.value)}
                  rows={3}
                  className="w-full px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Best wins (attributed) */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4" data-testid="founder-os-best-wins">
          <h2 className="text-sm font-medium text-amber-400/90 mb-3">Best wins (attributed)</h2>
          {memorySummary?.topEffectiveRuleKeys && memorySummary.topEffectiveRuleKeys.length > 0 ? (
            <ul className="text-sm space-y-2">
              {memorySummary.topEffectiveRuleKeys.slice(0, 5).map((r) => (
                <li key={r.ruleKey} className="flex items-center justify-between gap-2">
                  <span className="text-xs">{r.ruleKey}</span>
                  <span className="text-xs text-emerald-400">
                    +{r.netLiftScore.toFixed(1)} lift · {r.executions} exec
                    {r.avgScoreDelta != null ? ` · score Δ${r.avgScoreDelta >= 0 ? "+" : ""}${r.avgScoreDelta.toFixed(0)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-neutral-500">No attributed wins yet. Execute actions to build attribution.</p>
          )}
        </div>

        {/* Noisy suggestions */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4" data-testid="founder-os-noisy-suggestions">
          <h2 className="text-sm font-medium text-amber-400/90 mb-3">Noisy suggestions</h2>
          {memorySummary?.topNoisyRuleKeys && memorySummary.topNoisyRuleKeys.length > 0 ? (
            <ul className="text-sm space-y-2">
              {memorySummary.topNoisyRuleKeys.slice(0, 5).map((r) => (
                <li key={r.ruleKey} className="flex items-center gap-2">
                  <span className="text-xs">{r.ruleKey}</span>
                  <span className="text-xs text-neutral-500">
                    {r.dismissCount ?? 0} dismiss · {r.netLiftScore.toFixed(1)} lift
                  </span>
                  <button
                    type="button"
                    onClick={() => void applySuppressionAction.execute(r.ruleKey)}
                    disabled={applySuppressionAction.pending}
                    className="text-xs px-2 py-0.5 rounded border border-neutral-600 hover:bg-neutral-800 text-amber-400 disabled:opacity-50"
                  >
                    Suppress 30d
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-neutral-500">No noisy suggestions.</p>
          )}
        </div>

        {/* Trend Diffs */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4" data-testid="founder-os-trend-diffs">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-amber-400/90">Trend Diffs</h2>
            <button
              type="button"
              onClick={() => void runPolicyEngineAction.execute()}
              disabled={runPolicyEngineAction.pending}
              className="text-xs px-2 py-1 rounded border border-neutral-600 hover:bg-neutral-800 text-amber-400 disabled:opacity-50"
              data-testid="founder-os-run-policy"
            >
              {runPolicyEngineAction.pending ? "Running…" : "Run policy"}
            </button>
          </div>
          {memorySummary?.trendDiffs ? (
            <div className="text-sm space-y-3">
              <div>
                <p className="text-xs text-neutral-500 mb-1">Up this week</p>
                <ul className="text-xs space-y-0.5">
                  {memorySummary.trendDiffs.recurring
                    .filter((d) => d.direction === "up" && d.delta > 0)
                    .slice(0, 5)
                    .map((d) => (
                      <li key={d.ruleKey}>
                        {d.ruleKey}: +{d.delta} ({d.currentCount} vs {d.priorCount})
                      </li>
                    ))}
                  {memorySummary.trendDiffs.recurring.filter((d) => d.direction === "up" && d.delta > 0).length === 0 && (
                    <li className="text-neutral-500">None</li>
                  )}
                </ul>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-1">Down this week</p>
                <ul className="text-xs space-y-0.5">
                  {memorySummary.trendDiffs.recurring
                    .filter((d) => d.direction === "down")
                    .slice(0, 5)
                    .map((d) => (
                      <li key={d.ruleKey}>
                        {d.ruleKey}: {d.delta} ({d.currentCount} vs {d.priorCount})
                      </li>
                    ))}
                  {memorySummary.trendDiffs.recurring.filter((d) => d.direction === "down").length === 0 && (
                    <li className="text-neutral-500">None</li>
                  )}
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-xs text-neutral-500">Loading trend diffs…</p>
          )}
        </div>

        {/* Pattern Alerts */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4" data-testid="founder-os-pattern-alerts">
          <h2 className="text-sm font-medium text-amber-400/90 mb-3">Pattern Alerts</h2>
          {memorySummary?.patternAlerts && memorySummary.patternAlerts.length > 0 ? (
            <ul className="text-sm space-y-2">
              {memorySummary.patternAlerts.map((a) => (
                <li key={a.ruleKey} className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-medium">{a.title}</span>
                    <span className={`ml-1 text-xs ${a.severity === "critical" ? "text-red-400" : a.severity === "high" ? "text-amber-400" : "text-neutral-400"}`}>
                      ({a.severity})
                    </span>
                    {a.riskFlagExists && (
                      <Link
                        href="/dashboard/risk"
                        className="ml-2 text-xs text-amber-400 hover:underline"
                      >
                        Open Risk →
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-neutral-500">No pattern alerts.</p>
          )}
        </div>

        {/* Auto-suppress suggestions */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4" data-testid="founder-os-patterns">
          <h2 className="text-sm font-medium text-amber-400/90 mb-3">Auto-suppress suggestions</h2>
          {memorySummary ? (
            <div className="text-sm space-y-2">
              {(memorySummary.policySuggestions ?? memorySummary.suggestedSuppressions).length > 0 ? (
                <div className="space-y-2">
                  {(memorySummary.policySuggestions ?? memorySummary.suggestedSuppressions).map((s) => (
                    <div key={s.ruleKey} className="flex flex-wrap items-center gap-2">
                      <span className="text-xs">{s.ruleKey}</span>
                      {"confidence" in s && (
                        <span className="text-xs text-neutral-500">
                          {(s.confidence * 100).toFixed(0)}% confidence
                        </span>
                      )}
                      {"reasons" in s && s.reasons?.length > 0 && (
                        <span className="text-xs text-neutral-500">— {s.reasons.join("; ")}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => void applySuppressionAction.execute(s.ruleKey)}
                        disabled={applySuppressionAction.pending}
                        className="text-xs px-2 py-0.5 rounded border border-neutral-600 hover:bg-neutral-800 text-amber-400 disabled:opacity-50"
                      >
                        Apply 30d suppression
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-neutral-500">No suggested suppressions.</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-neutral-500">Loading patterns…</p>
          )}
        </div>

        <Link href="/dashboard/founder/os" className="text-sm text-amber-400 hover:underline">
          ← Founder OS
        </Link>
      </AsyncState>
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
