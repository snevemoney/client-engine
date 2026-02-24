"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Target, FileCheck, Activity, Plug, AlertTriangle, Inbox, Calendar } from "lucide-react";

function formatRelative(ms: number): string {
  if (ms < 0) return "—";
  if (ms < 60_000) return "just now";
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)} min ago`;
  return `${Math.floor(ms / 3600_000)} hr ago`;
}

type ScoreboardData = {
  weekStart: string;
  phase: string | null;
  activeCampaignName: string | null;
  weeklyTargetValue: number | null;
  weeklyTargetUnit: string | null;
  declaredCommitment: string | null;
  keyMetric: string | null;
  keyMetricTarget: string | null;
  fuelStatement: string | null;
  alerts?: string[];
  review: {
    campaignShipped: boolean;
    systemImproved: boolean;
    salesActionsDone: boolean;
    proofCaptured: boolean;
    score: number | null;
    biggestBottleneck: string | null;
    nextAutomation: string | null;
    completedAt: string | null;
  } | null;
  prioritiesDone: number;
  prioritiesTotal: number;
  integrationReady?: number;
  integrationTotal?: number;
};

type IntakeSummary = {
  newThisWeek: number;
  qualified: number;
  sent: number;
  won: number;
  sentThisWeek?: number;
  wonThisWeek?: number;
  proofCreatedThisWeek?: number;
} | null;

type FollowupSummary = {
  followupsDueToday: number;
  followupsOverdue: number;
  followupsCompletedThisWeek: number;
  nextFollowupDue: string | null;
} | null;

export function ScoreboardView() {
  const [data, setData] = useState<ScoreboardData | null>(null);
  const [intakeSummary, setIntakeSummary] = useState<IntakeSummary>(null);
  const [followupSummary, setFollowupSummary] = useState<FollowupSummary>(null);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);

  const refresh = () => {
    Promise.all([
      fetch("/api/ops/scoreboard").then((r) => r.json()),
      fetch("/api/intake-leads/summary").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/followups/summary").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([d, intake, followup]) => {
      if (d && typeof d === "object" && "weekStart" in d) {
        setData(d as ScoreboardData);
      } else {
        setData(null);
      }
      setIntakeSummary(intake && typeof intake === "object" ? intake as IntakeSummary : null);
      setFollowupSummary(followup && typeof followup === "object" ? followup as FollowupSummary : null);
      setFetchedAt(Date.now());
    }).catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  const [displayNow, setDisplayNow] = useState(0);
  useEffect(() => {
    const tick = () => setDisplayNow(() => Date.now());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [fetchedAt]);

  if (loading) {
    return (
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
        <p className="text-sm text-neutral-500">Loading…</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
        <p className="text-sm text-neutral-500 mb-4">No strategy week set yet.</p>
        <Link href="/dashboard/strategy">
          <Button variant="outline" size="sm">
            Set up strategy
          </Button>
        </Link>
      </section>
    );
  }

  const weekDate = (() => {
    try {
      const d = new Date(data.weekStart);
      return Number.isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  })();
  const weekLabel = weekDate
    ? weekDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "—";

  const checks = data.review
    ? [
        { label: "Campaign shipped", done: data.review.campaignShipped },
        { label: "System improved", done: data.review.systemImproved },
        { label: "Sales actions done", done: data.review.salesActionsDone },
        { label: "Proof captured", done: data.review.proofCaptured },
      ]
    : [];
  const reviewCount = checks.filter((c) => c.done).length;
  const reviewTotal = 4;

  const reviewStatusLabel = data.review?.completedAt ? "Review completed" : "Review pending";

  return (
    <div className="space-y-4">
      {fetchedAt != null && (
        <p className="text-xs text-neutral-500 flex items-center gap-2">
          <span>Updated {formatRelative((displayNow || fetchedAt) - fetchedAt)}</span>
          <button
            type="button"
            onClick={refresh}
            className="text-amber-300 hover:text-amber-200 underline-offset-2 hover:underline"
          >
            Refresh
          </button>
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
          <Target className="w-4 h-4" />
          Execution
        </h2>
        <div className="space-y-2 text-sm">
          <div className="flex gap-2">
            <span className="text-neutral-500">Week:</span>
            <span className="text-neutral-300">{weekLabel}</span>
          </div>
          {data.phase && (
            <div className="flex gap-2">
              <span className="text-neutral-500">Phase:</span>
              <Badge variant="outline" className="capitalize">
                {data.phase}
              </Badge>
            </div>
          )}
          {data.activeCampaignName && (
            <div className="flex gap-2">
              <span className="text-neutral-500">Campaign:</span>
              <span className="text-neutral-300 truncate">{data.activeCampaignName}</span>
            </div>
          )}
          {data.weeklyTargetValue != null && (
            <div className="flex gap-2">
              <span className="text-neutral-500">Target:</span>
              <span className="text-neutral-300">
                {data.weeklyTargetValue} {data.weeklyTargetUnit ?? ""}
              </span>
            </div>
          )}
          {data.keyMetric && (
            <div className="flex gap-2">
              <span className="text-neutral-500">Key metric:</span>
              <span className="text-neutral-300 truncate">{data.keyMetric}{data.keyMetricTarget ? ` → ${data.keyMetricTarget}` : ""}</span>
            </div>
          )}
          {data.fuelStatement && (
            <div className="flex gap-2">
              <span className="text-neutral-500">Fuel:</span>
              <span className="text-neutral-300 line-clamp-2" title={data.fuelStatement}>{data.fuelStatement}</span>
            </div>
          )}
        </div>
        <Link href="/dashboard/strategy" className="inline-block mt-3">
          <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200">
            Open Strategy
          </Button>
        </Link>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
          <FileCheck className="w-4 h-4" />
          Review status
        </h2>
        <p className="text-xs text-neutral-500 mb-2">{reviewStatusLabel}</p>
        <div className="space-y-2">
          {checks.map((c) => (
            <div key={c.label} className="flex items-center gap-2 text-sm">
              {c.done ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-neutral-600 shrink-0" />
              )}
              <span className={c.done ? "text-neutral-300" : "text-neutral-500"}>
                {c.label}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Badge
            variant="outline"
            className={
              reviewCount === reviewTotal
                ? "text-emerald-400 border-emerald-700"
                : "text-neutral-400 border-neutral-600"
            }
          >
            {reviewCount}/{reviewTotal} complete
          </Badge>
          {data.review?.score != null && (
            <Badge variant="outline" className="text-amber-400 border-amber-700">
              Score: {data.review.score}
            </Badge>
          )}
        </div>
        <Link href="/dashboard/reviews" className="inline-block mt-3">
          <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200">
            Open Reviews
          </Button>
        </Link>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Operator health
        </h2>
        <p className="text-xs text-neutral-500 mb-2">Workday run, failures, briefing</p>
        <Link href="/dashboard/ops-health">
          <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200">
            Open Ops Health
          </Button>
        </Link>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
          <Plug className="w-4 h-4" />
          Integration readiness
        </h2>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-neutral-200">
            {data.integrationReady ?? 0}/{data.integrationTotal ?? 0}
          </span>
          <span className="text-sm text-neutral-500">ready</span>
        </div>
        <Link href="/dashboard/settings" className="inline-block mt-2">
          <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200">
            Open Settings
          </Button>
        </Link>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Alerts
        </h2>
        {data.alerts && data.alerts.length > 0 ? (
          <ul className="text-xs space-y-1 mb-3">
            {data.alerts.map((a, i) => (
              <li key={i} className="text-amber-400/90">{a}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-neutral-500 mb-2">All clear</p>
        )}
        <div className="flex gap-2">
          <Link href="/dashboard/strategy">
            <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200">
              Strategy
            </Button>
          </Link>
          <Link href="/dashboard/ops-health">
            <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200">
              Ops Health
            </Button>
          </Link>
        </div>
      </section>

      {followupSummary != null && (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Follow-up Queue
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center text-sm mb-2">
            <div>
              <div className="font-semibold text-amber-400">{followupSummary.followupsDueToday ?? 0}</div>
              <div className="text-xs text-neutral-500">Due today</div>
            </div>
            <div>
              <div className="font-semibold text-red-400">{followupSummary.followupsOverdue ?? 0}</div>
              <div className="text-xs text-neutral-500">Overdue</div>
            </div>
            <div>
              <div className="font-semibold text-emerald-400">{followupSummary.followupsCompletedThisWeek ?? 0}</div>
              <div className="text-xs text-neutral-500">Done this week</div>
            </div>
          </div>
          {followupSummary.nextFollowupDue && (
            <p className="text-xs text-neutral-500">
              Next due: {new Date(followupSummary.nextFollowupDue).toLocaleDateString()}
            </p>
          )}
          <Link href="/dashboard/followups" className="inline-block mt-3">
            <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200">
              Open Follow-ups
            </Button>
          </Link>
        </section>
      )}

      {intakeSummary != null && (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
            <Inbox className="w-4 h-4" />
            Lead Intake
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-sm">
            <div>
              <div className="font-semibold text-neutral-200">{intakeSummary.newThisWeek}</div>
              <div className="text-xs text-neutral-500">New (wk)</div>
            </div>
            <div>
              <div className="font-semibold text-neutral-200">{intakeSummary.qualified}</div>
              <div className="text-xs text-neutral-500">Qualified</div>
            </div>
            <div>
              <div className="font-semibold text-neutral-200">{intakeSummary.sent}</div>
              <div className="text-xs text-neutral-500">Sent{typeof intakeSummary.sentThisWeek === "number" ? ` (${intakeSummary.sentThisWeek} wk)` : ""}</div>
            </div>
            <div>
              <div className="font-semibold text-emerald-400">{intakeSummary.won}</div>
              <div className="text-xs text-neutral-500">Won{typeof intakeSummary.wonThisWeek === "number" ? ` (${intakeSummary.wonThisWeek} wk)` : ""}</div>
            </div>
            {(intakeSummary.proofCreatedThisWeek ?? 0) > 0 && (
              <div className="col-span-2 sm:col-span-4">
                <div className="font-semibold text-amber-400">{intakeSummary.proofCreatedThisWeek}</div>
                <div className="text-xs text-neutral-500">Proof records this week</div>
              </div>
            )}
          </div>
          <Link href="/dashboard/intake" className="inline-block mt-3">
            <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200">
              Open Intake
            </Button>
          </Link>
        </section>
      )}

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 sm:col-span-2 lg:col-span-1">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">Priorities</h2>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-neutral-200">
            {data.prioritiesDone ?? 0}/{data.prioritiesTotal ?? 0}
          </span>
          <span className="text-sm text-neutral-500">done</span>
        </div>
        {data.declaredCommitment && (
          <p className="text-xs text-neutral-500 mt-2 line-clamp-2" title={data.declaredCommitment}>
            {data.declaredCommitment}
          </p>
        )}
        <Link href="/dashboard/strategy" className="inline-block mt-3">
          <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200">
            Open Strategy
          </Button>
        </Link>
      </section>
      </div>
    </div>
  );
}
