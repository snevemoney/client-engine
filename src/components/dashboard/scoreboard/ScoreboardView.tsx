"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Target, FileCheck, Activity, Plug, AlertTriangle, Inbox, Calendar, ClipboardList, FileText, Package } from "lucide-react";

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

type ProofCandidateSummary = {
  createdThisWeek?: number;
  readyThisWeek?: number;
  promotedThisWeek?: number;
  pendingDrafts?: number;
  pendingReady?: number;
} | null;

type ActionSummary = {
  unscoredCount?: number;
  readyToPromoteCount?: number;
  promotedMissingNextActionCount?: number;
  sentFollowupOverdueCount?: number;
  wonMissingProofCount?: number;
} | null;

type ProofGapsSummary = {
  wonLeadsWithoutProofCandidate?: number;
  readyCandidatesPendingPromotion?: number;
  proofRecordsMissingFields?: number;
  promotedThisWeek?: number;
} | null;

type ProposalFunnel = {
  drafts?: number;
  ready?: number;
  sentThisWeek?: number;
  acceptedThisWeek?: number;
  rejectedThisWeek?: number;
  readyNotSent?: number;
  sentNoResponseOver7d?: number;
  draftsIncomplete?: number;
  acceptedNoProject?: number;
  sentNoFollowupDate?: number;
  followupOverdue?: number;
  stale?: number;
  meetingBookedThisWeek?: number;
} | null;

type DeliveryOps = {
  inProgress?: number;
  dueSoon?: number;
  overdue?: number;
  completedThisWeek?: number;
  proofRequestedPending?: number;
  missingGithubLoom?: number;
  qaIncomplete?: number;
  handoffIncomplete?: number;
  completedNoProofCandidate?: number;
  completedNoHandoff?: number;
  handoffInProgress?: number;
  clientConfirmed?: number;
  handoffMissingClientConfirm?: number;
  retentionDueToday?: number;
  retentionOverdue?: number;
  testimonialReceived?: number;
  referralReceived?: number;
  upsellOpen?: number;
  retainerOpen?: number;
} | null;

export function ScoreboardView() {
  const [data, setData] = useState<ScoreboardData | null>(null);
  const [intakeSummary, setIntakeSummary] = useState<IntakeSummary>(null);
  const [followupSummary, setFollowupSummary] = useState<FollowupSummary>(null);
  const [proofCandidateSummary, setProofCandidateSummary] = useState<ProofCandidateSummary>(null);
  const [actionSummary, setActionSummary] = useState<ActionSummary>(null);
  const [proofGapsSummary, setProofGapsSummary] = useState<ProofGapsSummary>(null);
  const [proposalFunnel, setProposalFunnel] = useState<ProposalFunnel>(null);
  const [deliveryOps, setDeliveryOps] = useState<DeliveryOps>(null);
  const [metricsSummary, setMetricsSummary] = useState<{
    conversion?: { proposalSentToAcceptedRate?: number; acceptedToDeliveryStartedRate?: number; deliveryCompletedToProofRate?: number };
    revenue?: { acceptedValueThisWeek?: number; deliveredValueThisWeek?: number; avgAcceptedValue?: number; upsellOpenValue?: number };
    bottlenecks?: Array<{ label: string; count: number }>;
  } | null>(null);
  const [operatorScore, setOperatorScore] = useState<{
    weekly?: { score: number; grade: string; topRisks?: string[]; deltaVsPrev?: { delta: number } };
  } | null>(null);
  const [forecastData, setForecastData] = useState<{
    weekly?: { metrics: Array<{ key: string; label: string; projected: number }> };
    monthly?: { metrics: Array<{ key: string; label: string; projected: number }> };
    behindPaceCount?: number;
  } | null>(null);
  const [remindersSummary, setRemindersSummary] = useState<{
    open?: number;
    overdue?: number;
    today?: number;
    doneThisWeek?: number;
  } | null>(null);
  const [automationSummary, setAutomationSummary] = useState<{
    pending?: number;
    highPriority?: number;
    appliedThisWeek?: number;
  } | null>(null);
  const [observabilitySummary, setObservabilitySummary] = useState<{
    errorsToday?: number;
    slowEventsToday?: number;
    topEventKeys?: { eventKey: string; count: number }[];
  } | null>(null);
  const [auditSummary, setAuditSummary] = useState<{
    actionsToday?: number;
    proposalsSentThisWeek?: number;
    deliveriesCompletedThisWeek?: number;
    proofsPromotedThisWeek?: number;
  } | null>(null);
  const [notificationSummary, setNotificationSummary] = useState<{
    pending?: number;
    sentToday?: number;
    failedToday?: number;
    criticalOpen?: number;
    unreadInApp?: number;
    deadLetterAlerts?: number;
    staleJobAlerts?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);

  const refresh = () => {
    Promise.all([
      fetch("/api/ops/scoreboard").then((r) => r.json()),
      fetch("/api/intake-leads/summary").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/followups/summary").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/proof-candidates/summary").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/intake-leads/action-summary").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/proof-gaps/summary").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      Promise.all([
        fetch("/api/proposals/summary").then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch("/api/proposals/gaps-summary").then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch("/api/proposals/followup-summary").then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch("/api/proposals/action-summary").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]).then(([sum, gaps, followup, action]) => ({ sum, gaps, followup, action })),
      Promise.all([
        fetch("/api/delivery-projects/summary").then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch("/api/delivery-projects/gaps-summary").then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch("/api/delivery-projects/handoff-summary").then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch("/api/delivery-projects/retention-summary").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]).then(([sum, gaps, handoff, retention]) => ({ sum, gaps, handoff, retention })),
      fetch("/api/metrics/summary").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/operator-score/current").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/forecast/current").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/reminders/summary").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/automation-suggestions/summary").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/ops-events/summary").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/audit-actions/summary").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/notifications/summary").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([d, intake, followup, proofCand, action, proofGaps, proposalData, deliveryData, metricsData, opScore, forecast, reminders, automation, obs, audit, notif]) => {
      if (d && typeof d === "object" && "weekStart" in d) {
        setData(d as ScoreboardData);
      } else {
        setData(null);
      }
      setIntakeSummary(intake && typeof intake === "object" ? intake as IntakeSummary : null);
      setFollowupSummary(followup && typeof followup === "object" ? followup as FollowupSummary : null);
      setProofCandidateSummary(proofCand && typeof proofCand === "object" ? proofCand as ProofCandidateSummary : null);
      setActionSummary(action && typeof action === "object" ? action as ActionSummary : null);
      setProofGapsSummary(proofGaps && typeof proofGaps === "object" ? proofGaps as ProofGapsSummary : null);
      const pf = proposalData?.sum != null || proposalData?.gaps != null || proposalData?.followup != null || proposalData?.action != null
        ? {
            ...(proposalData?.sum ?? {}),
            ...(proposalData?.gaps ?? {}),
            ...(proposalData?.followup ?? {}),
            ...(proposalData?.action ?? {}),
          }
        : {};
      setProposalFunnel(pf);
      const sum = deliveryData?.sum ?? {};
      const gaps = deliveryData?.gaps ?? {};
      const handoff = deliveryData?.handoff ?? {};
      const retention = deliveryData?.retention ?? {};
      const do_ = deliveryData?.sum != null || deliveryData?.gaps != null || deliveryData?.handoff != null || deliveryData?.retention != null
        ? {
            ...sum,
            ...gaps,
            ...handoff,
            retentionOverdue: retention.overdue ?? 0,
            retentionDueToday: retention.dueToday ?? 0,
            testimonialReceived: retention.testimonialReceived ?? 0,
            referralReceived: retention.referralReceived ?? 0,
            upsellOpen: retention.upsellOpen ?? 0,
            retainerOpen: retention.retainerOpen ?? 0,
          }
        : {};
      setDeliveryOps(do_);
      setMetricsSummary(metricsData && typeof metricsData === "object" ? metricsData : null);
      setOperatorScore(opScore && typeof opScore === "object" ? opScore : null);
      setForecastData(forecast && typeof forecast === "object" ? forecast : null);
      setRemindersSummary(reminders && typeof reminders === "object" ? reminders : null);
      setAutomationSummary(automation && typeof automation === "object" ? automation : null);
      setObservabilitySummary(obs && typeof obs === "object" ? obs : null);
      setAuditSummary(audit && typeof audit === "object" ? audit : null);
      setNotificationSummary(notif && typeof notif === "object" ? notif : null);
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

  const hasStrategy = !!data;
  const weekDate = hasStrategy && data
    ? (() => {
        try {
          const d = new Date(data.weekStart);
          return Number.isNaN(d.getTime()) ? null : d;
        } catch {
          return null;
        }
      })()
    : null;
  const weekLabel = weekDate
    ? weekDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "—";

  const checks = data?.review
    ? [
        { label: "Campaign shipped", done: data.review.campaignShipped },
        { label: "System improved", done: data.review.systemImproved },
        { label: "Sales actions done", done: data.review.salesActionsDone },
        { label: "Proof captured", done: data.review.proofCaptured },
      ]
    : [];
  const reviewCount = checks.filter((c) => c.done).length;
  const reviewTotal = 4;

  const reviewStatusLabel = data?.review?.completedAt ? "Review completed" : "Review pending";

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
      {!hasStrategy && (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
          <p className="text-sm text-neutral-500 mb-4">No strategy week set yet.</p>
          <Link href="/dashboard/strategy">
            <Button variant="outline" size="sm">
              Set up strategy
            </Button>
          </Link>
        </section>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {hasStrategy && (
      <>
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
          {data?.phase && (
            <div className="flex gap-2">
              <span className="text-neutral-500">Phase:</span>
              <Badge variant="outline" className="capitalize">
                {data.phase}
              </Badge>
            </div>
          )}
          {data?.activeCampaignName && (
            <div className="flex gap-2">
              <span className="text-neutral-500">Campaign:</span>
              <span className="text-neutral-300 truncate">{data.activeCampaignName}</span>
            </div>
          )}
          {data?.weeklyTargetValue != null && (
            <div className="flex gap-2">
              <span className="text-neutral-500">Target:</span>
              <span className="text-neutral-300">
                {data.weeklyTargetValue} {data.weeklyTargetUnit ?? ""}
              </span>
            </div>
          )}
          {data?.keyMetric && (
            <div className="flex gap-2">
              <span className="text-neutral-500">Key metric:</span>
              <span className="text-neutral-300 truncate">{data.keyMetric}{data.keyMetricTarget ? ` → ${data.keyMetricTarget}` : ""}</span>
            </div>
          )}
          {data?.fuelStatement && (
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
          {data?.review?.score != null && (
            <Badge variant="outline" className="text-amber-400 border-amber-700">
              Score: {data?.review?.score}
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
            {data?.integrationReady ?? 0}/{data?.integrationTotal ?? 0}
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
        {data?.alerts && data.alerts.length > 0 ? (
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

      </>)}
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

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
          <Inbox className="w-4 h-4" />
          Pipeline Hygiene
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center text-sm mb-2">
          <div>
            <div className="font-semibold text-amber-400">{actionSummary?.readyToPromoteCount ?? 0}</div>
            <div className="text-xs text-neutral-500">Ready to promote</div>
          </div>
          <div>
            <div className="font-semibold text-neutral-300">{actionSummary?.promotedMissingNextActionCount ?? 0}</div>
            <div className="text-xs text-neutral-500">Missing next action</div>
          </div>
          <div>
            <div className="font-semibold text-red-400">{actionSummary?.sentFollowupOverdueCount ?? 0}</div>
            <div className="text-xs text-neutral-500">Follow-up overdue</div>
          </div>
        </div>
        <Link href="/dashboard/intake" className="inline-block mt-2">
          <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200">
            Open Intake
          </Button>
        </Link>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Proposal Funnel
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-sm mb-2">
          <div>
            <div className="font-semibold text-neutral-200">{proposalFunnel?.drafts ?? 0}</div>
            <div className="text-xs text-neutral-500">Drafts</div>
          </div>
          <div>
            <div className="font-semibold text-neutral-200">{proposalFunnel?.ready ?? 0}</div>
            <div className="text-xs text-neutral-500">Ready</div>
          </div>
          <div>
            <div className="font-semibold text-emerald-400">{proposalFunnel?.sentThisWeek ?? 0}</div>
            <div className="text-xs text-neutral-500">Sent (wk)</div>
          </div>
          <div>
            <div className="font-semibold text-emerald-400">{proposalFunnel?.acceptedThisWeek ?? 0}</div>
            <div className="text-xs text-neutral-500">Accepted (wk)</div>
          </div>
        </div>
        <Link href="/dashboard/proposals" className="inline-block mt-2">
          <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200">
            Open Proposals
          </Button>
        </Link>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Proposal Gaps
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-sm mb-2">
          <div>
            <div className="font-semibold text-amber-400">{proposalFunnel?.readyNotSent ?? 0}</div>
            <div className="text-xs text-neutral-500">Ready not sent</div>
          </div>
          <div>
            <div className="font-semibold text-amber-400">{proposalFunnel?.sentNoResponseOver7d ?? 0}</div>
            <div className="text-xs text-neutral-500">No response &gt;7d</div>
          </div>
          <div>
            <div className="font-semibold text-amber-400">{proposalFunnel?.sentNoFollowupDate ?? 0}</div>
            <div className="text-xs text-neutral-500">No follow-up date</div>
          </div>
          <div>
            <div className="font-semibold text-red-400">{proposalFunnel?.followupOverdue ?? 0}</div>
            <div className="text-xs text-neutral-500">Follow-up overdue</div>
          </div>
          <div>
            <div className="font-semibold text-red-400">{proposalFunnel?.stale ?? 0}</div>
            <div className="text-xs text-neutral-500">Stale</div>
          </div>
          <div>
            <div className="font-semibold text-emerald-400">{proposalFunnel?.meetingBookedThisWeek ?? 0}</div>
            <div className="text-xs text-neutral-500">Meetings (wk)</div>
          </div>
          <div>
            <div className="font-semibold text-neutral-300">{proposalFunnel?.draftsIncomplete ?? 0}</div>
            <div className="text-xs text-neutral-500">Drafts incomplete</div>
          </div>
          <div>
            <div className="font-semibold text-red-400">{proposalFunnel?.acceptedNoProject ?? 0}</div>
            <div className="text-xs text-neutral-500">Accepted no project</div>
          </div>
        </div>
        <Link href="/dashboard/proposals" className="inline-block mt-2">
          <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200">
            Open Proposals
          </Button>
        </Link>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
          <Package className="w-4 h-4" />
          Delivery Ops
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-sm mb-2">
          <div>
            <div className="font-semibold text-neutral-200">{deliveryOps?.inProgress ?? 0}</div>
            <div className="text-xs text-neutral-500">In progress</div>
          </div>
          <div>
            <div className="font-semibold text-amber-400">{deliveryOps?.dueSoon ?? 0}</div>
            <div className="text-xs text-neutral-500">Due soon</div>
          </div>
          <div>
            <div className="font-semibold text-red-400">{deliveryOps?.overdue ?? 0}</div>
            <div className="text-xs text-neutral-500">Overdue</div>
          </div>
          <div>
            <div className="font-semibold text-emerald-400">{deliveryOps?.completedThisWeek ?? 0}</div>
            <div className="text-xs text-neutral-500">Completed (wk)</div>
          </div>
        </div>
        <Link href="/dashboard/delivery" className="inline-block mt-2">
          <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200">
            Open Delivery
          </Button>
        </Link>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
          <Package className="w-4 h-4" />
          Delivery Gaps
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-sm mb-2">
          <div>
            <div className="font-semibold text-amber-400">{deliveryOps?.missingGithubLoom ?? 0}</div>
            <div className="text-xs text-neutral-500">Missing GitHub/Loom</div>
          </div>
          <div>
            <div className="font-semibold text-neutral-300">{deliveryOps?.qaIncomplete ?? 0}</div>
            <div className="text-xs text-neutral-500">QA incomplete</div>
          </div>
          <div>
            <div className="font-semibold text-neutral-300">{deliveryOps?.handoffIncomplete ?? 0}</div>
            <div className="text-xs text-neutral-500">Handoff incomplete</div>
          </div>
          <div>
            <div className="font-semibold text-red-400">{deliveryOps?.completedNoProofCandidate ?? 0}</div>
            <div className="text-xs text-neutral-500">Completed no proof</div>
          </div>
        </div>
        {((deliveryOps?.completedNoHandoff ?? 0) > 0 || (deliveryOps?.handoffInProgress ?? 0) > 0 || (deliveryOps?.handoffMissingClientConfirm ?? 0) > 0) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-sm mb-2 mt-2">
            <div>
              <Link href="/dashboard/handoffs?status=completed_no_handoff">
                <div className="font-semibold text-amber-400 hover:underline">{deliveryOps?.completedNoHandoff ?? 0}</div>
              </Link>
              <div className="text-xs text-neutral-500">Completed no handoff</div>
            </div>
            <div>
              <Link href="/dashboard/handoffs?status=handoff_in_progress">
                <div className="font-semibold text-blue-400 hover:underline">{deliveryOps?.handoffInProgress ?? 0}</div>
              </Link>
              <div className="text-xs text-neutral-500">Handoff in progress</div>
            </div>
            <div>
              <div className="font-semibold text-emerald-400">{deliveryOps?.clientConfirmed ?? 0}</div>
              <div className="text-xs text-neutral-500">Client confirmed</div>
            </div>
            <div>
              <Link href="/dashboard/handoffs?status=handoff_missing_client_confirm">
                <div className="font-semibold text-amber-400 hover:underline">{deliveryOps?.handoffMissingClientConfirm ?? 0}</div>
              </Link>
              <div className="text-xs text-neutral-500">Missing client confirm</div>
            </div>
          </div>
        )}
        {((deliveryOps?.retentionDueToday ?? 0) > 0 || (deliveryOps?.retentionOverdue ?? 0) > 0 || (deliveryOps?.testimonialReceived ?? 0) > 0 || (deliveryOps?.upsellOpen ?? 0) > 0 || (deliveryOps?.retainerOpen ?? 0) > 0) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-sm mb-2 mt-2">
            <div>
              <Link href="/dashboard/retention?bucket=overdue">
                <div className="font-semibold text-red-400 hover:underline">{deliveryOps?.retentionOverdue ?? 0}</div>
              </Link>
              <div className="text-xs text-neutral-500">Retention overdue</div>
            </div>
            <div>
              <Link href="/dashboard/retention?bucket=today">
                <div className="font-semibold text-amber-400 hover:underline">{deliveryOps?.retentionDueToday ?? 0}</div>
              </Link>
              <div className="text-xs text-neutral-500">Due today</div>
            </div>
            <div>
              <div className="font-semibold text-emerald-400">{deliveryOps?.testimonialReceived ?? 0}</div>
              <div className="text-xs text-neutral-500">Testimonial received</div>
            </div>
            <div>
              <Link href="/dashboard/retention?status=upsell_open">
                <div className="font-semibold text-emerald-400 hover:underline">{deliveryOps?.upsellOpen ?? 0}</div>
              </Link>
              <div className="text-xs text-neutral-500">Upsell open</div>
            </div>
            <div>
              <Link href="/dashboard/retention?status=retainer_open">
                <div className="font-semibold text-emerald-400 hover:underline">{deliveryOps?.retainerOpen ?? 0}</div>
              </Link>
              <div className="text-xs text-neutral-500">Retainer open</div>
            </div>
          </div>
        )}
        <Link href="/dashboard/delivery" className="inline-block mt-2">
          <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200">
            Open Delivery
          </Button>
        </Link>
      </section>

      {metricsSummary && (
        <>
          <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
            <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
              <Target className="w-4 h-4" />
              Conversion Health
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-sm mb-2">
              <div>
                <div className="font-semibold">{(metricsSummary.conversion?.proposalSentToAcceptedRate ?? 0) * 100}%</div>
                <div className="text-xs text-neutral-500">Sent→Accepted</div>
              </div>
              <div>
                <div className="font-semibold">{(metricsSummary.conversion?.acceptedToDeliveryStartedRate ?? 0) * 100}%</div>
                <div className="text-xs text-neutral-500">Accepted→Delivery</div>
              </div>
              <div>
                <div className="font-semibold">{(metricsSummary.conversion?.deliveryCompletedToProofRate ?? 0) * 100}%</div>
                <div className="text-xs text-neutral-500">Delivery→Proof</div>
              </div>
              <div>
                <div className="font-semibold text-amber-400 text-xs truncate" title={metricsSummary.bottlenecks?.[0]?.label}>
                  {metricsSummary.bottlenecks?.[0]?.label ?? "—"}
                </div>
                <div className="text-xs text-neutral-500">Top leak</div>
              </div>
            </div>
            <Link href="/dashboard/intelligence" className="inline-block mt-2">
              <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200">
                Open Intelligence
              </Button>
            </Link>
          </section>
          <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
            <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Revenue Health
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-sm mb-2">
              <div>
                <div className="font-semibold text-emerald-400">${(metricsSummary.revenue?.acceptedValueThisWeek ?? 0).toLocaleString()}</div>
                <div className="text-xs text-neutral-500">Accepted (wk)</div>
              </div>
              <div>
                <div className="font-semibold text-emerald-400">${(metricsSummary.revenue?.deliveredValueThisWeek ?? 0).toLocaleString()}</div>
                <div className="text-xs text-neutral-500">Delivered (wk)</div>
              </div>
              <div>
                <div className="font-semibold">${(metricsSummary.revenue?.avgAcceptedValue ?? 0).toLocaleString()}</div>
                <div className="text-xs text-neutral-500">Avg accepted</div>
              </div>
              <div>
                <div className="font-semibold text-amber-400">${(metricsSummary.revenue?.upsellOpenValue ?? 0).toLocaleString()}</div>
                <div className="text-xs text-neutral-500">Upsell open</div>
              </div>
            </div>
            <Link href="/dashboard/intelligence" className="inline-block mt-2">
              <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200">
                Open Intelligence
              </Button>
            </Link>
          </section>
        </>
      )}

      {operatorScore?.weekly != null && (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Operator Score
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-sm mb-2">
            <div>
              <div className="font-semibold">{operatorScore.weekly.score}</div>
              <div className="text-xs text-neutral-500">Weekly score</div>
            </div>
            <div>
              <div className="font-semibold">{operatorScore.weekly.grade}</div>
              <div className="text-xs text-neutral-500">Grade</div>
            </div>
            <div>
              <div className="font-semibold text-amber-400 text-xs truncate" title={operatorScore.weekly.topRisks?.[0]}>
                {operatorScore.weekly.topRisks?.[0] ?? "—"}
              </div>
              <div className="text-xs text-neutral-500">Top risk</div>
            </div>
            <div>
              <div className="font-semibold">
                {operatorScore.weekly.deltaVsPrev?.delta != null && operatorScore.weekly.deltaVsPrev.delta !== 0
                  ? `${operatorScore.weekly.deltaVsPrev.delta > 0 ? "+" : ""}${operatorScore.weekly.deltaVsPrev.delta}`
                  : "—"}
              </div>
              <div className="text-xs text-neutral-500">Δ vs last week</div>
            </div>
          </div>
          <Link href="/dashboard/operator" className="inline-block mt-2">
            <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200">
              Open Operator Score
            </Button>
          </Link>
        </section>
      )}

      {forecastData != null && ((forecastData.weekly?.metrics?.length ?? 0) > 0 || (forecastData.monthly?.metrics?.length ?? 0) > 0) && (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Forecast Health
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-sm mb-2">
            {(() => {
              const m = forecastData.weekly?.metrics ?? [];
              const proposals = m.find((x) => x.key === "proposals_sent");
              const deliveries = m.find((x) => x.key === "delivery_completed");
              const value = m.find((x) => x.key === "delivered_value");
              return (
                <>
                  <div>
                    <div className="font-semibold">{proposals?.projected ?? "—"}</div>
                    <div className="text-xs text-neutral-500">Proposals sent (proj)</div>
                  </div>
                  <div>
                    <div className="font-semibold">{deliveries?.projected ?? "—"}</div>
                    <div className="text-xs text-neutral-500">Deliveries (proj)</div>
                  </div>
                  <div>
                    <div className="font-semibold text-emerald-400">
                      {(() => {
                        const monthlyValue = forecastData.monthly?.metrics?.find((x) => x.key === "delivered_value");
                        return monthlyValue != null ? `$${monthlyValue.projected.toLocaleString()}` : "—";
                      })()}
                    </div>
                    <div className="text-xs text-neutral-500">Delivered value (mo)</div>
                  </div>
                  <div>
                    <div className="font-semibold text-amber-400">{forecastData.behindPaceCount ?? 0}</div>
                    <div className="text-xs text-neutral-500">Behind pace</div>
                  </div>
                </>
              );
            })()}
          </div>
          <Link href="/dashboard/forecast" className="inline-block mt-2">
            <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200">
              Open Forecast
            </Button>
          </Link>
        </section>
      )}

      {remindersSummary != null && ((remindersSummary.open ?? 0) > 0 || (remindersSummary.doneThisWeek ?? 0) > 0) && (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Reminder Queue
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-sm mb-2">
            <div>
              <div className="font-semibold">{remindersSummary.open ?? 0}</div>
              <div className="text-xs text-neutral-500">Open</div>
            </div>
            <div>
              <div className="font-semibold text-red-400">{remindersSummary.overdue ?? 0}</div>
              <div className="text-xs text-neutral-500">Overdue</div>
            </div>
            <div>
              <div className="font-semibold text-amber-400">{remindersSummary.today ?? 0}</div>
              <div className="text-xs text-neutral-500">Due today</div>
            </div>
            <div>
              <div className="font-semibold text-emerald-400">{remindersSummary.doneThisWeek ?? 0}</div>
              <div className="text-xs text-neutral-500">Done (wk)</div>
            </div>
          </div>
          <Link href="/dashboard/reminders" className="inline-block mt-2">
            <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200">
              Open Reminders
            </Button>
          </Link>
        </section>
      )}

      {notificationSummary != null && (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
            <Inbox className="w-4 h-4" />
            Notifications Health
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-sm mb-2">
            <div>
              <div className="font-semibold">{notificationSummary.pending ?? 0}</div>
              <div className="text-xs text-neutral-500">Pending</div>
            </div>
            <div>
              <div className="font-semibold text-red-400">{notificationSummary.failedToday ?? 0}</div>
              <div className="text-xs text-neutral-500">Failed today</div>
            </div>
            <div>
              <div className="font-semibold text-red-400">{notificationSummary.criticalOpen ?? 0}</div>
              <div className="text-xs text-neutral-500">Critical open</div>
            </div>
            <div>
              <div className="font-semibold">{notificationSummary.unreadInApp ?? 0}</div>
              <div className="text-xs text-neutral-500">Unread in-app</div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 text-center text-sm mb-2">
            <div>
              <div className="font-semibold text-amber-400">{notificationSummary.deadLetterAlerts ?? 0}</div>
              <div className="text-xs text-neutral-500">Dead-letter (7d)</div>
            </div>
            <div>
              <div className="font-semibold text-amber-400">{notificationSummary.staleJobAlerts ?? 0}</div>
              <div className="text-xs text-neutral-500">Stale jobs (7d)</div>
            </div>
          </div>
          <Link href="/dashboard/inbox" className="inline-block mt-2">
            <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200">
              Open Inbox
            </Button>
          </Link>
        </section>
      )}

      {(observabilitySummary != null || auditSummary != null) && (
        <>
          <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
            <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Observability Health
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center text-sm mb-2">
              <div>
                <div className="font-semibold text-red-400">{observabilitySummary?.errorsToday ?? 0}</div>
                <div className="text-xs text-neutral-500">Errors today</div>
              </div>
              <div>
                <div className="font-semibold text-amber-400">{observabilitySummary?.slowEventsToday ?? 0}</div>
                <div className="text-xs text-neutral-500">Slow events</div>
              </div>
              <div>
                <div className="font-semibold text-xs truncate" title={observabilitySummary?.topEventKeys?.[0]?.eventKey ?? undefined}>
                  {observabilitySummary?.topEventKeys?.[0]?.eventKey ?? "—"}
                </div>
                <div className="text-xs text-neutral-500">Top event</div>
              </div>
            </div>
            <Link href="/dashboard/observability" className="inline-block mt-2">
              <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200">
                Open Observability
              </Button>
            </Link>
          </section>
          <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
            <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
              <FileCheck className="w-4 h-4" />
              Audit Activity
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-sm mb-2">
              <div>
                <div className="font-semibold">{auditSummary?.actionsToday ?? 0}</div>
                <div className="text-xs text-neutral-500">Actions today</div>
              </div>
              <div>
                <div className="font-semibold text-emerald-400">{auditSummary?.proposalsSentThisWeek ?? 0}</div>
                <div className="text-xs text-neutral-500">Proposals sent (wk)</div>
              </div>
              <div>
                <div className="font-semibold text-emerald-400">{auditSummary?.deliveriesCompletedThisWeek ?? 0}</div>
                <div className="text-xs text-neutral-500">Deliveries done (wk)</div>
              </div>
              <div>
                <div className="font-semibold text-emerald-400">{auditSummary?.proofsPromotedThisWeek ?? 0}</div>
                <div className="text-xs text-neutral-500">Proofs promoted (wk)</div>
              </div>
            </div>
            <Link href="/dashboard/audit" className="inline-block mt-2">
              <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200">
                Open Audit
              </Button>
            </Link>
          </section>
        </>
      )}

      {automationSummary != null && ((automationSummary.pending ?? 0) > 0 || (automationSummary.appliedThisWeek ?? 0) > 0) && (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Automation Suggestions
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center text-sm mb-2">
            <div>
              <div className="font-semibold">{automationSummary.pending ?? 0}</div>
              <div className="text-xs text-neutral-500">Pending</div>
            </div>
            <div>
              <div className="font-semibold text-amber-400">{automationSummary.highPriority ?? 0}</div>
              <div className="text-xs text-neutral-500">High priority</div>
            </div>
            <div>
              <div className="font-semibold text-emerald-400">{automationSummary.appliedThisWeek ?? 0}</div>
              <div className="text-xs text-neutral-500">Applied (wk)</div>
            </div>
          </div>
          <Link href="/dashboard/automation" className="inline-block mt-2">
            <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200">
              Open Automation
            </Button>
          </Link>
        </section>
      )}

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
          <ClipboardList className="w-4 h-4" />
          Proof Gaps
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-sm mb-2">
          <div>
            <div className="font-semibold text-amber-400">{proofGapsSummary?.wonLeadsWithoutProofCandidate ?? 0}</div>
            <div className="text-xs text-neutral-500">Won missing proof</div>
          </div>
          <div>
            <div className="font-semibold text-neutral-300">{proofGapsSummary?.readyCandidatesPendingPromotion ?? 0}</div>
            <div className="text-xs text-neutral-500">Ready pending</div>
          </div>
          <div>
            <div className="font-semibold text-red-400">{proofGapsSummary?.proofRecordsMissingFields ?? 0}</div>
            <div className="text-xs text-neutral-500">Incomplete</div>
          </div>
          <div>
            <div className="font-semibold text-emerald-400">{proofGapsSummary?.promotedThisWeek ?? 0}</div>
            <div className="text-xs text-neutral-500">Promoted (wk)</div>
          </div>
        </div>
        <Link href="/dashboard/proof-candidates" className="inline-block mt-2">
          <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200">
            Open Proof Candidates
          </Button>
        </Link>
      </section>

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

      {hasStrategy && (
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 sm:col-span-2 lg:col-span-1">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">Priorities</h2>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-neutral-200">
            {data?.prioritiesDone ?? 0}/{data?.prioritiesTotal ?? 0}
          </span>
          <span className="text-sm text-neutral-500">done</span>
        </div>
        {data?.declaredCommitment && (
          <p className="text-xs text-neutral-500 mt-2 line-clamp-2" title={data.declaredCommitment}>
            {data?.declaredCommitment}
          </p>
        )}
        <Link href="/dashboard/strategy" className="inline-block mt-3">
          <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200">
            Open Strategy
          </Button>
        </Link>
      </section>
      )}
      </div>
    </div>
  );
}
