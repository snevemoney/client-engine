"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useRetryableFetch } from "@/hooks/useRetryableFetch";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { fetchJsonThrow } from "@/lib/http/fetch-json";
import { AsyncState } from "@/components/ui/AsyncState";

type FounderMove = {
  title: string;
  why: string;
  expectedImpact: string;
  actionKey: string;
  nextActionId?: string;
  nbaActionKey?: string;
  sources: Array<{ kind: string; id?: string; route?: string }>;
};

type GrowthSummary = {
  countsByStage: Record<string, number>;
  overdueFollowUps: Array<{ id: string; prospectName: string; stage: string }>;
  next7DaysFollowUps: Array<{ id: string; prospectName: string; stage: string }>;
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

const ENTITY = { entityType: "command_center", entityId: "command_center" };
const toastFn = (m: string, t?: "success" | "error") => t === "error" ? toast.error(m) : toast.success(m);

export default function FounderPage() {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const {
    data: summary,
    loading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useRetryableFetch<FounderSummary>(
    `/api/internal/founder/summary?entityType=${ENTITY.entityType}&entityId=${ENTITY.entityId}`
  );

  const {
    data: growthContext,
    loading: growthLoading,
    error: growthError,
    refetch: refetchGrowth,
  } = useRetryableFetch<{ summary: GrowthSummary }>("/api/internal/growth/context");

  const loading = summaryLoading || growthLoading;
  const error = summaryError || growthError;

  const refetchAll = useCallback(() => {
    refetchSummary();
    refetchGrowth();
  }, [refetchSummary, refetchGrowth]);

  const { execute: executeAction, pending: actionPending } = useAsyncAction(
    async (actionKey: string, nextActionId?: string, nbaActionKey?: string) => {
      setActionLoading(actionKey);
      try {
        if (actionKey === "nba_execute" && nextActionId && nbaActionKey) {
          await fetchJsonThrow(`/api/next-actions/${nextActionId}/execute`, {
            method: "POST",
            body: JSON.stringify({ actionKey: nbaActionKey }),
          });
        } else if (actionKey === "run_next_actions") {
          await fetchJsonThrow(
            `/api/next-actions/run?entityType=${ENTITY.entityType}&entityId=${ENTITY.entityId}`,
            { method: "POST" }
          );
        } else if (actionKey === "run_risk_rules") {
          await fetchJsonThrow("/api/risk/run-rules", { method: "POST" });
        } else if (actionKey === "recompute_score") {
          await fetchJsonThrow("/api/internal/scores/compute", {
            method: "POST",
            body: JSON.stringify(ENTITY),
          });
        }
        refetchAll();
      } finally {
        setActionLoading(null);
      }
    },
    {
      toast: toastFn,
      successMessage: "Action completed.",
    }
  );

  const isDisabled = actionPending || !!actionLoading;

  return (
    <div className="space-y-6" data-testid="founder-page">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Founder Mode</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Daily execution plan, business health, and recent actions.
        </p>
      </div>

      <AsyncState loading={loading} error={error} onRetry={refetchAll}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Card 1: Today's Plan */}
          <div
            className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4"
            data-testid="founder-todays-plan"
          >
            <h2 className="text-sm font-medium text-amber-400/90 mb-3">Today&apos;s Plan (Top 3)</h2>
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                type="button"
                onClick={() => executeAction("run_next_actions")}
                disabled={isDisabled}
                className="rounded-md border border-neutral-600 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
                data-testid="founder-run-next-actions"
              >
                Run Next Actions
              </button>
              <button
                type="button"
                onClick={() => executeAction("run_risk_rules")}
                disabled={isDisabled}
                className="rounded-md border border-neutral-600 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
              >
                Run Risk Rules
              </button>
              <button
                type="button"
                onClick={() => executeAction("recompute_score")}
                disabled={isDisabled}
                className="rounded-md border border-neutral-600 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
              >
                Recompute Score
              </button>
            </div>
            <ul className="space-y-1.5">
              {(summary?.todayPlan ?? []).map((m, i) => (
                <li key={i} className="border-l-2 border-amber-500/30 pl-2">
                  <span className="font-medium text-sm">{m.title}</span>
                  <p className="text-xs text-neutral-400">{m.why}</p>
                  <p className="text-xs text-neutral-500">Impact: {m.expectedImpact}</p>
                  <div className="flex gap-1 mt-1">
                    {m.actionKey === "nba_execute" && m.nextActionId && (
                      <>
                        <button
                          type="button"
                          onClick={() => executeAction(m.actionKey, m.nextActionId, m.nbaActionKey)}
                          disabled={isDisabled}
                          className="rounded bg-amber-500/20 text-amber-400 px-2 py-0.5 text-xs hover:bg-amber-500/30 disabled:opacity-50"
                        >
                          Execute
                        </button>
                        <Link
                          href={`/dashboard/next-actions?highlight=${m.nextActionId}`}
                          className="rounded border border-neutral-600 px-2 py-0.5 text-xs text-neutral-400 hover:bg-neutral-800"
                        >
                          Open playbook
                        </Link>
                      </>
                    )}
                    {m.actionKey === "run_risk_rules" && (
                      <button
                        type="button"
                        onClick={() => executeAction("run_risk_rules")}
                        disabled={isDisabled}
                        className="rounded bg-amber-500/20 text-amber-400 px-2 py-0.5 text-xs hover:bg-amber-500/30 disabled:opacity-50"
                      >
                        Run risk rules
                      </button>
                    )}
                    {m.actionKey === "recompute_score" && (
                      <button
                        type="button"
                        onClick={() => executeAction("recompute_score")}
                        disabled={isDisabled}
                        className="rounded bg-amber-500/20 text-amber-400 px-2 py-0.5 text-xs hover:bg-amber-500/30 disabled:opacity-50"
                      >
                        Recompute score
                      </button>
                    )}
                  </div>
                  {m.sources?.length > 0 && (
                    <details className="mt-0.5">
                      <summary className="text-neutral-600 text-xs cursor-pointer">Evidence</summary>
                      <p className="text-neutral-600 text-xs pl-2">
                        {m.sources.map((s) => `${s.kind}:${s.id ?? s.route}`).join(", ")}
                      </p>
                    </details>
                  )}
                </li>
              ))}
            </ul>
            {(!summary?.todayPlan || summary.todayPlan.length === 0) && (
              <p className="text-xs text-neutral-500">No moves. Run refresh actions above.</p>
            )}
          </div>

          {/* Card 2: Business Health */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4" data-testid="founder-business-health">
            <h2 className="text-sm font-medium text-amber-400/90 mb-3">Business Health</h2>
            <div className="text-xs space-y-2">
              <p>
                <span className="text-neutral-500">Score:</span>{" "}
                {summary?.score?.latest
                  ? `${summary.score.latest.score} (${summary.score.latest.band})`
                  : "—"}
                {summary?.score?.previous && summary?.score?.latest && (
                  <span className="text-neutral-500 ml-1">
                    (7d delta: {summary.score.latest.score - summary.score.previous.score})
                  </span>
                )}
              </p>
              <p>
                <span className="text-neutral-500">Risks:</span>{" "}
                {(summary?.risk?.summary?.openBySeverity?.critical ?? 0) +
                  (summary?.risk?.summary?.openBySeverity?.high ?? 0)}{" "}
                critical/high open. Last run: {summary?.risk?.summary?.lastRunAt?.slice(0, 10) ?? "never"}
              </p>
              <p>
                <span className="text-neutral-500">NBA:</span>{" "}
                {Object.values(summary?.nba?.summary?.queuedByPriority ?? {}).reduce((a, b) => a + b, 0)} queued. Last
                run: {summary?.nba?.summary?.lastRunAt?.slice(0, 10) ?? "never"}
              </p>
            </div>
          </div>

          {/* Card 3: Pipeline Snapshot */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
            <h2 className="text-sm font-medium text-amber-400/90 mb-3">Pipeline Snapshot</h2>
            {summary?.pipeline ? (
              <div className="text-xs space-y-1">
                <p>
                  <span className="text-neutral-500">By stage:</span>{" "}
                  {Object.entries(summary.pipeline?.byStage ?? {})
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(", ") || "—"}
                </p>
                <p>
                  <span className="text-neutral-500">Stuck &gt;7d:</span> {summary.pipeline?.stuckOver7d ?? 0}
                </p>
                <p>
                  <span className="text-neutral-500">No next step:</span> {summary.pipeline?.noNextStep ?? 0}
                </p>
                <Link href="/dashboard/leads" className="text-amber-400 hover:underline text-xs">
                  View pipeline →
                </Link>
              </div>
            ) : (
              <p className="text-xs text-neutral-500">
                <Link href="/dashboard/leads" className="text-amber-400 hover:underline">
                  View pipeline
                </Link>
              </p>
            )}
          </div>

          {/* Card: Pipeline Follow-ups (Growth) */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4" data-testid="founder-pipeline-followups">
            <h2 className="text-sm font-medium text-amber-400/90 mb-3">Pipeline Follow-ups</h2>
            <div className="text-xs space-y-1">
              <p>
                <span className="text-neutral-500">Overdue:</span>{" "}
                {growthContext?.summary?.overdueFollowUps?.length ?? 0}
              </p>
              <p>
                <span className="text-neutral-500">Next 7 days:</span>{" "}
                {growthContext?.summary?.next7DaysFollowUps?.length ?? 0}
              </p>
              <Link href="/dashboard/growth" className="text-amber-400 hover:underline">
                Open Growth →
              </Link>
            </div>
          </div>

          {/* Card 4: Recent Execution */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4" data-testid="founder-execution">
            <h2 className="text-sm font-medium text-amber-400/90 mb-3">Recent Execution (7d)</h2>
            <ul className="space-y-1 text-xs">
              {(summary?.execution?.recentCopilotActions ?? []).slice(0, 5).map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/dashboard/copilot/sessions?id=${a.sessionId}`}
                    className="text-amber-400 hover:underline"
                  >
                    {a.actionKey} — {a.status}
                  </Link>{" "}
                  <span className="text-neutral-500">{a.createdAt.slice(0, 10)}</span>
                </li>
              ))}
              {(summary?.execution?.recentNextActionExecutions ?? []).slice(0, 5).map((e) => (
                <li key={e.id}>
                  {e.nextActionTitle ?? e.nextActionId} — {e.status}{" "}
                  <span className="text-neutral-500">{e.startedAt.slice(0, 10)}</span>
                </li>
              ))}
            </ul>
            {(!(summary?.execution?.recentCopilotActions?.length) &&
              !(summary?.execution?.recentNextActionExecutions?.length)) && (
              <p className="text-neutral-500 text-xs">No recent actions.</p>
            )}
          </div>
        </div>

        {/* Card 5: Weekly Review shortcut */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-amber-400/90 mb-3">Weekly Review</h2>
          <p className="text-xs text-neutral-500 mb-2">
            Top risks this week: {(summary?.risk?.summary?.openBySeverity?.critical ?? 0) +
              (summary?.risk?.summary?.openBySeverity?.high ?? 0)} critical/high.
          </p>
          <Link
            href="/dashboard/copilot/sessions"
            className="text-amber-400 hover:underline text-xs"
          >
            View coach sessions →
          </Link>
        </div>
      </AsyncState>
    </div>
  );
}
