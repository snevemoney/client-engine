"use client";

import { useCallback, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useRetryableFetch } from "@/hooks/useRetryableFetch";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { fetchJsonThrow } from "@/lib/http/fetch-json";
import { AsyncState } from "@/components/ui/AsyncState";
import { useBrainPanel } from "@/contexts/BrainPanelContext";

type FounderMove = {
  title: string;
  why: string;
  expectedImpact: string;
  actionKey: string;
  nextActionId?: string;
  nbaActionKey?: string;
  sources: Array<{ kind: string; id?: string; route?: string }>;
};

type FounderSummary = {
  score: {
    latest: { score: number; band: string; computedAt: string } | null;
    previous: { score: number; computedAt: string } | null;
    history7d: Array<{ score: number; band: string; computedAt: string }>;
  };
  risk: {
    summary: { openBySeverity: Record<string, number>; lastRunAt: string | null };
    topOpen5: Array<{ id: string; title: string; severity: string }>;
  };
  nba: {
    summary: { queuedByPriority: Record<string, number>; lastRunAt: string | null };
    topQueued5: Array<{ id: string; title: string; priority: string; score: number }>;
  };
  pipeline: {
    byStage: Record<string, number>;
    stuckOver7d: number;
    noNextStep: number;
  } | null;
  execution: {
    recentCopilotActions: Array<{
      id: string;
      actionKey: string;
      status: string;
      createdAt: string;
      sessionId: string;
    }>;
    recentNextActionExecutions: Array<{
      id: string;
      actionKey: string;
      status: string;
      startedAt: string;
      nextActionId: string;
      nextActionTitle?: string;
    }>;
  };
  todayPlan: FounderMove[];
};

type QuarterData = {
  id: string | null;
  startsAt: string;
  endsAt: string;
  title: string;
  notes: string | null;
  kpis?: Array<{ id: string; key: string; label: string; targetValue: number; currentValue: number | null; unit: string }>;
};

type WeekData = {
  week: { id: string | null; weekStart: string; weekEnd: string; focusConstraint: string | null };
  plan: { topOutcomes: unknown[]; milestones: unknown[]; commitments: unknown[] };
  review: { wins: unknown[]; misses: unknown[]; deltas: unknown[]; decisions: unknown[]; retroNotes: string | null };
};

const ENTITY = { entityType: "command_center", entityId: "command_center" };
const toastFn = (m: string, t?: "success" | "error") => t === "error" ? toast.error(m) : toast.success(m);

function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${start.toLocaleDateString("en-CA", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}`;
}

function bandColor(band: string): string {
  if (band === "critical") return "text-red-400";
  if (band === "warning") return "text-amber-400";
  if (band === "healthy") return "text-emerald-400";
  return "text-neutral-400";
}

export default function FounderPage() {
  const {
    data: summary,
    loading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useRetryableFetch<FounderSummary>(
    `/api/internal/founder/summary?entityType=${ENTITY.entityType}&entityId=${ENTITY.entityId}`
  );

  const {
    data: quarter,
    loading: quarterLoading,
    error: quarterError,
    refetch: refetchQuarter,
  } = useRetryableFetch<QuarterData>("/api/internal/founder/os/quarter");

  const {
    data: currentWeek,
    loading: weekLoading,
    error: weekError,
    refetch: refetchWeek,
  } = useRetryableFetch<WeekData>("/api/internal/founder/os/week");

  const loading = summaryLoading || quarterLoading || weekLoading;
  const error = summaryError || quarterError || weekError;

  const refetchAll = useCallback(() => {
    refetchSummary();
    refetchQuarter();
    refetchWeek();
  }, [refetchSummary, refetchQuarter, refetchWeek]);

  const { execute: executeAction, pending: actionPending } = useAsyncAction(
    async (actionKey: string, nextActionId?: string, nbaActionKey?: string) => {
      if (actionKey === "nba_execute" && nextActionId && nbaActionKey) {
        await fetchJsonThrow(`/api/next-actions/${nextActionId}/execute`, {
          method: "POST",
          body: JSON.stringify({ actionKey: nbaActionKey }),
        });
      }
      refetchAll();
    },
    { toast: toastFn, successMessage: "Action completed." }
  );

  const weekHasPlan = (currentWeek?.plan.topOutcomes?.length ?? 0) > 0;
  const weekHasReview = (currentWeek?.review.wins?.length ?? 0) > 0 || (currentWeek?.review.misses?.length ?? 0) > 0;

  const criticalHighRisks =
    (summary?.risk?.summary?.openBySeverity?.critical ?? 0) +
    (summary?.risk?.summary?.openBySeverity?.high ?? 0);

  const totalNbaQueued = Object.values(summary?.nba?.summary?.queuedByPriority ?? {}).reduce(
    (a, b) => a + b,
    0
  );

  // Push page data for Brain auto-summary
  const { setPageData } = useBrainPanel();
  useEffect(() => {
    if (loading || !summary) return;
    const scoreStr = summary.score?.latest
      ? `Score ${summary.score.latest.score} (${summary.score.latest.band})`
      : "Score: —";
    const movesCount = summary.todayPlan?.length ?? 0;
    const quarterStr = quarter?.title ?? "no quarter";
    const weekFocus = currentWeek?.week?.focusConstraint ?? "none";
    setPageData(
      `Founder: ${scoreStr}. Risks: ${criticalHighRisks} critical+high. Actions: ${totalNbaQueued} queued. Today: ${movesCount} moves. Quarter: ${quarterStr}. Week focus: ${weekFocus}.`
    );
  }, [loading, summary, quarter, currentWeek, criticalHighRisks, totalNbaQueued, setPageData]);

  return (
    <div className="space-y-6" data-testid="founder-page">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Founder</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Daily plan, business health, and quarterly goals.
        </p>
      </div>

      <AsyncState loading={loading} error={error} onRetry={refetchAll}>
        {/* Row 1: Health + Today's Plan */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Business Health */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4" data-testid="founder-business-health">
            <h2 className="text-sm font-medium text-neutral-300 mb-3">Business Health</h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-neutral-500">Score</p>
                <p className={`text-lg font-semibold ${summary?.score?.latest ? bandColor(summary.score.latest.band) : "text-neutral-500"}`}>
                  {summary?.score?.latest ? summary.score.latest.score : "—"}
                  {summary?.score?.latest && (
                    <span className="text-xs font-normal text-neutral-500 ml-1">
                      {summary.score.latest.band}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex gap-4">
                <div>
                  <p className="text-xs text-neutral-500">Risks</p>
                  <Link href="/dashboard/risk" className="text-sm font-medium text-neutral-200 hover:text-amber-400">
                    {criticalHighRisks} open
                  </Link>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Actions</p>
                  <Link href="/dashboard/next-actions" className="text-sm font-medium text-neutral-200 hover:text-amber-400">
                    {totalNbaQueued} queued
                  </Link>
                </div>
              </div>
              {summary?.pipeline && (
                <div>
                  <p className="text-xs text-neutral-500">Pipeline</p>
                  <div className="text-xs text-neutral-400 space-y-0.5">
                    <p>
                      {Object.entries(summary.pipeline.byStage)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(", ") || "—"}
                    </p>
                    {summary.pipeline.stuckOver7d > 0 && (
                      <p className="text-amber-400/70">{summary.pipeline.stuckOver7d} stuck &gt;7d</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Today's Plan — spans 2 cols */}
          <div
            className="lg:col-span-2 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4"
            data-testid="founder-todays-plan"
          >
            <h2 className="text-sm font-medium text-neutral-300 mb-3">Today&apos;s Plan</h2>
            {(summary?.todayPlan ?? []).length > 0 ? (
              <ul className="space-y-3">
                {summary!.todayPlan.map((m, i) => (
                  <li key={i} className="border-l-2 border-amber-500/30 pl-3">
                    <span className="font-medium text-sm">{m.title}</span>
                    <p className="text-xs text-neutral-400 mt-0.5">{m.why}</p>
                    <p className="text-xs text-neutral-500">Impact: {m.expectedImpact}</p>
                    {m.actionKey === "nba_execute" && m.nextActionId && (
                      <div className="flex gap-1 mt-1">
                        <button
                          type="button"
                          onClick={() => executeAction(m.actionKey, m.nextActionId, m.nbaActionKey)}
                          disabled={actionPending}
                          data-testid="founder-run-next-actions"
                          className="rounded bg-amber-500/20 text-amber-400 px-2 py-0.5 text-xs hover:bg-amber-500/30 disabled:opacity-50"
                        >
                          Execute
                        </button>
                        <Link
                          href={`/dashboard/next-actions?highlight=${m.nextActionId}`}
                          className="rounded border border-neutral-600 px-2 py-0.5 text-xs text-neutral-400 hover:bg-neutral-800"
                        >
                          View details
                        </Link>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-neutral-500">No priority moves today. All clear.</p>
            )}
          </div>
        </div>

        {/* Row 2: Quarter + Week */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          {/* Current Quarter */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-neutral-300">This Quarter</h2>
              <Link
                href="/dashboard/founder/os/quarter"
                className="text-xs text-amber-400 hover:underline"
              >
                Edit
              </Link>
            </div>
            {quarter ? (
              <div className="space-y-2">
                <p className="text-sm text-neutral-200">{quarter.title}</p>
                <p className="text-xs text-neutral-500">
                  {quarter.startsAt.slice(0, 10)} – {quarter.endsAt.slice(0, 10)}
                </p>
                {quarter.kpis && quarter.kpis.length > 0 && (
                  <ul className="text-xs space-y-1 mt-2">
                    {quarter.kpis.map((k) => (
                      <li key={k.id} className="flex justify-between">
                        <span className="text-neutral-400">{k.label}</span>
                        <span className="text-neutral-200">
                          {k.currentValue ?? "—"} / {k.targetValue} {k.unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="text-xs text-neutral-500">No quarter set up.</p>
            )}
          </div>

          {/* Current Week */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-neutral-300">This Week</h2>
              <Link
                href="/dashboard/founder/os/week"
                className="text-xs text-amber-400 hover:underline"
              >
                Edit
              </Link>
            </div>
            {currentWeek ? (
              <div className="space-y-2">
                <p className="text-sm text-neutral-400">{formatWeekRange(currentWeek.week.weekStart)}</p>
                {currentWeek.week.focusConstraint && (
                  <p className="text-xs text-neutral-200">
                    Focus: {currentWeek.week.focusConstraint}
                  </p>
                )}
                <div className="flex gap-4 text-xs">
                  <span className={weekHasPlan ? "text-emerald-400" : "text-neutral-500"}>
                    Plan {weekHasPlan ? "✓" : "—"}
                  </span>
                  <span className={weekHasReview ? "text-emerald-400" : "text-neutral-500"}>
                    Review {weekHasReview ? "✓" : "—"}
                  </span>
                </div>
                <div className="flex gap-2 mt-1">
                  <Link
                    href="/dashboard/founder/os/week?generate=1"
                    className="text-xs text-amber-400 hover:underline"
                  >
                    Generate suggestions
                  </Link>
                  <Link
                    href="/dashboard/reviews"
                    className="text-xs text-neutral-400 hover:underline"
                  >
                    Weekly review
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-xs text-neutral-500">No week data.</p>
            )}
          </div>
        </div>

        {/* Row 3: Recent Execution */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 mt-4" data-testid="founder-execution">
          <h2 className="text-sm font-medium text-neutral-300 mb-3">Recent Activity (7d)</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-neutral-500 mb-1">Copilot actions</p>
              <ul className="space-y-1 text-xs">
                {(summary?.execution?.recentCopilotActions ?? []).slice(0, 5).map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/dashboard/copilot/sessions?id=${a.sessionId}`}
                      className="text-amber-400 hover:underline"
                    >
                      {a.actionKey}
                    </Link>{" "}
                    <span className="text-neutral-500">
                      {a.status} · {a.createdAt.slice(0, 10)}
                    </span>
                  </li>
                ))}
                {!(summary?.execution?.recentCopilotActions?.length) && (
                  <li className="text-neutral-500">None</li>
                )}
              </ul>
            </div>
            <div>
              <p className="text-xs text-neutral-500 mb-1">Automated actions</p>
              <ul className="space-y-1 text-xs">
                {(summary?.execution?.recentNextActionExecutions ?? []).slice(0, 5).map((e) => (
                  <li key={e.id}>
                    <span className="text-neutral-200">{e.nextActionTitle ?? e.actionKey}</span>{" "}
                    <span className="text-neutral-500">
                      {e.status} · {e.startedAt.slice(0, 10)}
                    </span>
                  </li>
                ))}
                {!(summary?.execution?.recentNextActionExecutions?.length) && (
                  <li className="text-neutral-500">None</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </AsyncState>
    </div>
  );
}
