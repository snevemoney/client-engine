"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  Calendar,
  Inbox,
  ClipboardList,
  FileCheck,
  Plug,
  AlertTriangle,
  ChevronRight,
  FileText,
  Package,
  BarChart3,
  Layers,
} from "lucide-react";

type CommandCenterData = {
  todaysPriorities: { id: string; title: string; status: string; dueDate: string | null }[];
  followupQueue: {
    followupsOverdue: number;
    followupsDueToday: number;
    followupsUpcoming: number;
  };
  intakeActions: {
    unscoredCount: number;
    readyToPromoteCount: number;
    promotedMissingNextActionCount: number;
    sentFollowupOverdueCount: number;
    wonMissingProofCount: number;
  };
  proofGaps: {
    wonLeadsWithoutProofCandidate: number;
    readyCandidatesPendingPromotion: number;
    proofRecordsMissingFields: number;
    promotedThisWeek: number;
  };
  proofCandidates: {
    createdThisWeek: number;
    readyThisWeek: number;
    promotedThisWeek: number;
    pendingDrafts: number;
    pendingReady: number;
  };
  weeklyCommitments: {
    declaredCommitment: string | null;
    reviewCompleted: boolean;
    reviewCompletedAt: string | null;
  } | null;
  integrationHealth: {
    byMode: { off: number; mock: number; manual: number; live: number };
    errorCount: number;
    total: number;
  };
  proposalActions?: {
    readyNotSent: number;
    sentNoResponseOver7d: number;
    acceptedNoProject: number;
    draftsIncomplete: number;
    sentNoFollowupDate?: number;
    followupOverdue?: number;
    stale?: number;
    meetingBooked?: number;
    negotiating?: number;
  };
  deliveryOps?: {
    dueSoon: number;
    overdue: number;
    proofRequestedPending: number;
    completedNoProofCandidate: number;
  };
  handoffOps?: {
    completedNoHandoff: number;
    handoffInProgress: number;
    handoffDoneNoClientConfirm: number;
  };
  retentionOps?: {
    retentionOverdue: number;
    completedNoTestimonialRequest: number;
    completedNoReviewRequest: number;
    completedNoReferralRequest: number;
    completedNoRetentionFollowup: number;
    upsellOpen: number;
    retainerOpen: number;
    stalePostDelivery: number;
  };
  revenueIntelligence?: {
    proposalSentToAcceptedRate: number;
    acceptedToDeliveryStartedRate: number;
    deliveryCompletedToProofRate: number;
    deliveredValueThisWeek: number;
    topBottleneck: { label: string; count: number } | null;
  };
  operatorForecast?: {
    weeklyScore: number | null;
    weeklyGrade: string | null;
    monthlyScore: number | null;
    monthlyGrade: string | null;
    behindPaceWarning: string | null;
    deliveredValueProjectedMonth: number | null;
  };
  observability?: {
    eventsToday: number;
    errorsToday: number;
    slowEventsToday: number;
    lastErrorAt: string | null;
    topFailingAction: string | null;
  };
  auditSummary?: {
    actionsToday: number;
    proposalsSentThisWeek: number;
    deliveriesCompletedThisWeek: number;
    proofsPromotedThisWeek: number;
  };
  remindersAutomation?: {
    remindersOverdue: number;
    remindersDueToday: number;
    remindersHighPriority: number;
    suggestionsPending: number;
    bestNextAction: { type: string; title: string; url: string } | null;
  };
  jobsSummary?: {
    queued: number;
    running: number;
    failed: number;
    deadLetter?: number;
    succeeded24h: number;
    latestFailedJobType: string | null;
    staleRunning?: number;
    dueSchedules?: number;
  };
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

export default function CommandCenterPage() {
  const [data, setData] = useState<CommandCenterData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/command-center", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d && typeof d === "object" ? d : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Daily Ops</h1>
        <div className="py-12 text-center text-neutral-500">Loading…</div>
      </div>
    );
  }

  const d = data ?? {
    todaysPriorities: [],
    followupQueue: { followupsOverdue: 0, followupsDueToday: 0, followupsUpcoming: 0 },
    intakeActions: {
      unscoredCount: 0,
      readyToPromoteCount: 0,
      promotedMissingNextActionCount: 0,
      sentFollowupOverdueCount: 0,
      wonMissingProofCount: 0,
    },
    proofGaps: {
      wonLeadsWithoutProofCandidate: 0,
      readyCandidatesPendingPromotion: 0,
      proofRecordsMissingFields: 0,
      promotedThisWeek: 0,
    },
    proofCandidates: { createdThisWeek: 0, readyThisWeek: 0, promotedThisWeek: 0, pendingDrafts: 0, pendingReady: 0 },
    weeklyCommitments: null,
    integrationHealth: { byMode: { off: 0, mock: 0, manual: 0, live: 0 }, errorCount: 0, total: 0 },
    proposalActions: {
      readyNotSent: 0,
      sentNoResponseOver7d: 0,
      acceptedNoProject: 0,
      draftsIncomplete: 0,
      sentNoFollowupDate: 0,
      followupOverdue: 0,
      stale: 0,
      meetingBooked: 0,
      negotiating: 0,
    },
    deliveryOps: { dueSoon: 0, overdue: 0, proofRequestedPending: 0, completedNoProofCandidate: 0 },
    handoffOps: { completedNoHandoff: 0, handoffInProgress: 0, handoffDoneNoClientConfirm: 0 },
    retentionOps: {
      retentionOverdue: 0,
      completedNoTestimonialRequest: 0,
      completedNoReviewRequest: 0,
      completedNoReferralRequest: 0,
      completedNoRetentionFollowup: 0,
      upsellOpen: 0,
      retainerOpen: 0,
      stalePostDelivery: 0,
    },
    revenueIntelligence: {
      proposalSentToAcceptedRate: 0,
      acceptedToDeliveryStartedRate: 0,
      deliveryCompletedToProofRate: 0,
      deliveredValueThisWeek: 0,
      topBottleneck: null,
    },
    operatorForecast: {
      weeklyScore: null,
      weeklyGrade: null,
      monthlyScore: null,
      monthlyGrade: null,
      behindPaceWarning: null,
      deliveredValueProjectedMonth: null,
    },
    remindersAutomation: {
      remindersOverdue: 0,
      remindersDueToday: 0,
      remindersHighPriority: 0,
      suggestionsPending: 0,
      bestNextAction: null,
    },
    observability: {
      eventsToday: 0,
      errorsToday: 0,
      slowEventsToday: 0,
      lastErrorAt: null,
      topFailingAction: null,
    },
    auditSummary: {
      actionsToday: 0,
      proposalsSentThisWeek: 0,
      deliveriesCompletedThisWeek: 0,
      proofsPromotedThisWeek: 0,
    },
    jobsSummary: {
      queued: 0,
      running: 0,
      failed: 0,
      succeeded24h: 0,
      latestFailedJobType: null,
    },
  };

  const fp = d.followupQueue ?? { followupsOverdue: 0, followupsDueToday: 0, followupsUpcoming: 0 };
  const ia = d.intakeActions ?? {};
  const pg = d.proofGaps ?? {};
  const ih = d.integrationHealth ?? { byMode: { off: 0, mock: 0, manual: 0, live: 0 }, errorCount: 0, total: 0 };
  const pa = d.proposalActions ?? {
    readyNotSent: 0,
    sentNoResponseOver7d: 0,
    acceptedNoProject: 0,
    draftsIncomplete: 0,
    sentNoFollowupDate: 0,
    followupOverdue: 0,
    stale: 0,
    meetingBooked: 0,
    negotiating: 0,
  };
  const do_ = d.deliveryOps ?? { dueSoon: 0, overdue: 0, proofRequestedPending: 0, completedNoProofCandidate: 0 };
  const ho = d.handoffOps ?? { completedNoHandoff: 0, handoffInProgress: 0, handoffDoneNoClientConfirm: 0 };
  const ri = d.revenueIntelligence ?? {
    proposalSentToAcceptedRate: 0,
    acceptedToDeliveryStartedRate: 0,
    deliveryCompletedToProofRate: 0,
    deliveredValueThisWeek: 0,
    topBottleneck: null,
  };
  const ro = d.retentionOps ?? {
    retentionOverdue: 0,
    completedNoTestimonialRequest: 0,
    completedNoReviewRequest: 0,
    completedNoReferralRequest: 0,
    completedNoRetentionFollowup: 0,
    upsellOpen: 0,
    retainerOpen: 0,
    stalePostDelivery: 0,
  };

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Daily Ops</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Operator view: priorities, follow-ups, intake actions, proof gaps.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Today&apos;s Priorities
          </h2>
          {(d.todaysPriorities?.length ?? 0) > 0 ? (
            <ul className="space-y-2 text-sm">
              {d.todaysPriorities.slice(0, 5).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <span className="text-neutral-200 truncate">{p.title || "—"}</span>
                  <Badge variant="outline" className="shrink-0 text-xs">
                    {p.status ?? "todo"}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-neutral-500">No open priorities</p>
          )}
          <Link href="/dashboard/strategy" className="inline-block mt-3">
            <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200 gap-1">
              Open Strategy <ChevronRight className="w-3 h-3" />
            </Button>
          </Link>
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Follow-up Queue
          </h2>
          <div className="grid grid-cols-3 gap-2 text-center text-sm mb-2">
            <div>
              <div className="font-semibold text-red-400">{fp.followupsOverdue ?? 0}</div>
              <div className="text-xs text-neutral-500">Overdue</div>
            </div>
            <div>
              <div className="font-semibold text-amber-400">{fp.followupsDueToday ?? 0}</div>
              <div className="text-xs text-neutral-500">Today</div>
            </div>
            <div>
              <div className="font-semibold text-neutral-300">{fp.followupsUpcoming ?? 0}</div>
              <div className="text-xs text-neutral-500">Upcoming</div>
            </div>
          </div>
          <Link href="/dashboard/followups">
            <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200 gap-1">
              Open Follow-ups <ChevronRight className="w-3 h-3" />
            </Button>
          </Link>
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
            <Inbox className="w-4 h-4" />
            Intake Pipeline Actions
          </h2>
          <ul className="space-y-1 text-sm text-neutral-300">
            {(ia.unscoredCount ?? 0) > 0 && (
              <li>
                <Link href="/dashboard/intake?filter=needs-score" className="text-amber-400 hover:underline">
                  {(ia.unscoredCount ?? 0)} need score
                </Link>
              </li>
            )}
            {(ia.readyToPromoteCount ?? 0) > 0 && (
              <li>
                <Link href="/dashboard/intake?filter=ready" className="text-emerald-400 hover:underline">
                  {(ia.readyToPromoteCount ?? 0)} ready to promote
                </Link>
              </li>
            )}
            {(ia.promotedMissingNextActionCount ?? 0) > 0 && (
              <li>{(ia.promotedMissingNextActionCount ?? 0)} promoted, missing next action</li>
            )}
            {(ia.sentFollowupOverdueCount ?? 0) > 0 && (
              <li className="text-red-400">{(ia.sentFollowupOverdueCount ?? 0)} sent, follow-up overdue</li>
            )}
            {(ia.wonMissingProofCount ?? 0) > 0 && (
              <li>
                <Link href="/dashboard/intake?filter=won-missing-proof" className="text-amber-400 hover:underline">
                  {(ia.wonMissingProofCount ?? 0)} won, missing proof
                </Link>
              </li>
            )}
          </ul>
          {(ia.unscoredCount ?? 0) === 0 &&
            (ia.readyToPromoteCount ?? 0) === 0 &&
            (ia.wonMissingProofCount ?? 0) === 0 && (
              <p className="text-xs text-neutral-500 mt-2">All clear</p>
            )}
          <Link href="/dashboard/intake" className="inline-block mt-2">
            <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200 gap-1">
              Open Intake <ChevronRight className="w-3 h-3" />
            </Button>
          </Link>
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            Proof Gaps
          </h2>
          <ul className="space-y-1 text-sm text-neutral-300">
            {(pg.wonLeadsWithoutProofCandidate ?? 0) > 0 && (
              <li>
                <Link href="/dashboard/intake?filter=won-missing-proof" className="text-amber-400 hover:underline">
                  {(pg.wonLeadsWithoutProofCandidate ?? 0)} won without proof
                </Link>
              </li>
            )}
            {(pg.readyCandidatesPendingPromotion ?? 0) > 0 && (
              <li>
                <Link href="/dashboard/proof-candidates" className="text-emerald-400 hover:underline">
                  {(pg.readyCandidatesPendingPromotion ?? 0)} ready to promote
                </Link>
              </li>
            )}
            {(pg.proofRecordsMissingFields ?? 0) > 0 && (
              <li>{(pg.proofRecordsMissingFields ?? 0)} proof records incomplete</li>
            )}
          </ul>
          <div className="text-xs text-neutral-500 mt-2">
            {(pg.promotedThisWeek ?? 0)} promoted this week
          </div>
          <Link href="/dashboard/proof-candidates" className="inline-block mt-2">
            <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200 gap-1">
              Open Proof Candidates <ChevronRight className="w-3 h-3" />
            </Button>
          </Link>
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
            <FileCheck className="w-4 h-4" />
            Weekly Commitments
          </h2>
          {d.weeklyCommitments ? (
            <>
              {d.weeklyCommitments.declaredCommitment ? (
                <p className="text-sm text-neutral-300 line-clamp-2">{d.weeklyCommitments.declaredCommitment}</p>
              ) : (
                <p className="text-xs text-neutral-500">No commitment set</p>
              )}
              <div className="mt-2">
                {d.weeklyCommitments.reviewCompleted ? (
                  <Badge variant="success" className="text-xs">Review done</Badge>
                ) : (
                  <Badge variant="warning" className="text-xs">Review pending</Badge>
                )}
              </div>
            </>
          ) : (
            <p className="text-xs text-neutral-500">No strategy week</p>
          )}
          <div className="mt-3 flex gap-2">
            <Link href="/dashboard/reviews">
              <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200">
                Reviews
              </Button>
            </Link>
            <Link href="/dashboard/strategy">
              <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200">
                Strategy
              </Button>
            </Link>
          </div>
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Proposal Actions
          </h2>
          <ul className="space-y-1 text-sm text-neutral-300">
            {(pa.readyNotSent ?? 0) > 0 && (
              <li>
                <Link href="/dashboard/proposals?status=ready" className="text-amber-400 hover:underline">
                  {(pa.readyNotSent ?? 0)} ready not sent
                </Link>
              </li>
            )}
            {(pa.sentNoResponseOver7d ?? 0) > 0 && (
              <li className="text-amber-400">{(pa.sentNoResponseOver7d ?? 0)} sent, no response &gt;7d</li>
            )}
            {(pa.acceptedNoProject ?? 0) > 0 && (
              <li>
                <Link href="/dashboard/proposals?status=accepted" className="text-emerald-400 hover:underline">
                  {(pa.acceptedNoProject ?? 0)} accepted, no project
                </Link>
              </li>
            )}
            {(pa.draftsIncomplete ?? 0) > 0 && (
              <li>{(pa.draftsIncomplete ?? 0)} drafts incomplete</li>
            )}
          </ul>
          {(pa.readyNotSent ?? 0) === 0 && (pa.sentNoResponseOver7d ?? 0) === 0 && (pa.acceptedNoProject ?? 0) === 0 && (pa.draftsIncomplete ?? 0) === 0 && (
            <p className="text-xs text-neutral-500 mt-2">All clear</p>
          )}
          <Link href="/dashboard/proposals" className="inline-block mt-2">
            <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200 gap-1">
              Open Proposals <ChevronRight className="w-3 h-3" />
            </Button>
          </Link>
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Proposal Follow-up Ops
          </h2>
          <ul className="space-y-1 text-sm text-neutral-300">
            {(pa.sentNoFollowupDate ?? 0) > 0 && (
              <li>
                <Link href="/dashboard/proposal-followups?bucket=no_followup" className="text-amber-400 hover:underline">
                  {(pa.sentNoFollowupDate ?? 0)} sent, no follow-up date
                </Link>
              </li>
            )}
            {(pa.followupOverdue ?? 0) > 0 && (
              <li>
                <Link href="/dashboard/proposal-followups?bucket=overdue" className="text-red-400 hover:underline">
                  {(pa.followupOverdue ?? 0)} follow-up overdue
                </Link>
              </li>
            )}
            {(pa.stale ?? 0) > 0 && (
              <li>
                <Link href="/dashboard/proposal-followups?bucket=stale" className="text-red-400 hover:underline">
                  {(pa.stale ?? 0)} stale
                </Link>
              </li>
            )}
            {(pa.meetingBooked ?? 0) > 0 && (
              <li className="text-emerald-400">{(pa.meetingBooked ?? 0)} meeting booked</li>
            )}
            {(pa.negotiating ?? 0) > 0 && (
              <li className="text-emerald-400">{(pa.negotiating ?? 0)} negotiating</li>
            )}
          </ul>
          {(pa.sentNoFollowupDate ?? 0) === 0 &&
            (pa.followupOverdue ?? 0) === 0 &&
            (pa.stale ?? 0) === 0 &&
            (pa.meetingBooked ?? 0) === 0 &&
            (pa.negotiating ?? 0) === 0 && (
              <p className="text-xs text-neutral-500 mt-2">All clear</p>
            )}
          <Link href="/dashboard/proposal-followups" className="inline-block mt-2">
            <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200 gap-1">
              Open Proposal Follow-ups <ChevronRight className="w-3 h-3" />
            </Button>
          </Link>
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Delivery Ops
          </h2>
          <ul className="space-y-1 text-sm text-neutral-300">
            {(do_.dueSoon ?? 0) > 0 && (
              <li>
                <Link href="/dashboard/delivery?due=soon" className="text-amber-400 hover:underline">
                  {(do_.dueSoon ?? 0)} due soon
                </Link>
              </li>
            )}
            {(do_.overdue ?? 0) > 0 && (
              <li>
                <Link href="/dashboard/delivery?due=overdue" className="text-red-400 hover:underline">
                  {(do_.overdue ?? 0)} overdue
                </Link>
              </li>
            )}
            {(do_.completedNoProofCandidate ?? 0) > 0 && (
              <li>{(do_.completedNoProofCandidate ?? 0)} completed, no proof candidate</li>
            )}
            {(do_.proofRequestedPending ?? 0) > 0 && (
              <li>{(do_.proofRequestedPending ?? 0)} proof requested, pending</li>
            )}
          </ul>
          {(do_.dueSoon ?? 0) === 0 && (do_.overdue ?? 0) === 0 && (do_.completedNoProofCandidate ?? 0) === 0 && (do_.proofRequestedPending ?? 0) === 0 && (
            <p className="text-xs text-neutral-500 mt-2">All clear</p>
          )}
          <Link href="/dashboard/delivery" className="inline-block mt-2">
            <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200 gap-1">
              Open Delivery <ChevronRight className="w-3 h-3" />
            </Button>
          </Link>
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
            <FileCheck className="w-4 h-4" />
            Handoff Ops
          </h2>
          <ul className="space-y-1 text-sm text-neutral-300">
            {(ho.completedNoHandoff ?? 0) > 0 && (
              <li>
                <Link href="/dashboard/handoffs?status=completed_no_handoff" className="text-amber-400 hover:underline">
                  {(ho.completedNoHandoff ?? 0)} completed, no handoff
                </Link>
              </li>
            )}
            {(ho.handoffInProgress ?? 0) > 0 && (
              <li>
                <Link href="/dashboard/handoffs?status=handoff_in_progress" className="text-blue-400 hover:underline">
                  {(ho.handoffInProgress ?? 0)} handoff in progress
                </Link>
              </li>
            )}
            {(ho.handoffDoneNoClientConfirm ?? 0) > 0 && (
              <li>
                <Link href="/dashboard/handoffs?status=handoff_missing_client_confirm" className="text-amber-400 hover:underline">
                  {(ho.handoffDoneNoClientConfirm ?? 0)} handoff done, no client confirm
                </Link>
              </li>
            )}
          </ul>
          {(ho.completedNoHandoff ?? 0) === 0 &&
            (ho.handoffInProgress ?? 0) === 0 &&
            (ho.handoffDoneNoClientConfirm ?? 0) === 0 && (
              <p className="text-xs text-neutral-500 mt-2">All clear</p>
            )}
          <Link href="/dashboard/handoffs" className="inline-block mt-2">
            <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200 gap-1">
              Open Handoffs <ChevronRight className="w-3 h-3" />
            </Button>
          </Link>
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Retention Ops
          </h2>
          <ul className="space-y-1 text-sm text-neutral-300">
            {(ro.retentionOverdue ?? 0) > 0 && (
              <li>
                <Link href="/dashboard/retention?bucket=overdue" className="text-red-400 hover:underline">
                  {(ro.retentionOverdue ?? 0)} retention follow-up overdue
                </Link>
              </li>
            )}
            {(ro.completedNoTestimonialRequest ?? 0) > 0 && (
              <li>{(ro.completedNoTestimonialRequest ?? 0)} completed, no testimonial request</li>
            )}
            {(ro.completedNoReviewRequest ?? 0) > 0 && (
              <li>{(ro.completedNoReviewRequest ?? 0)} completed, no review request</li>
            )}
            {(ro.completedNoReferralRequest ?? 0) > 0 && (
              <li>{(ro.completedNoReferralRequest ?? 0)} completed, no referral request</li>
            )}
            {(ro.upsellOpen ?? 0) > 0 && (
              <li>
                <Link href="/dashboard/retention?status=upsell_open" className="text-emerald-400 hover:underline">
                  {(ro.upsellOpen ?? 0)} upsell open
                </Link>
              </li>
            )}
            {(ro.retainerOpen ?? 0) > 0 && (
              <li>
                <Link href="/dashboard/retention?status=retainer_open" className="text-emerald-400 hover:underline">
                  {(ro.retainerOpen ?? 0)} retainer open
                </Link>
              </li>
            )}
          </ul>
          {(ro.retentionOverdue ?? 0) === 0 &&
            (ro.completedNoTestimonialRequest ?? 0) === 0 &&
            (ro.completedNoReviewRequest ?? 0) === 0 &&
            (ro.completedNoReferralRequest ?? 0) === 0 &&
            (ro.upsellOpen ?? 0) === 0 &&
            (ro.retainerOpen ?? 0) === 0 && (
              <p className="text-xs text-neutral-500 mt-2">All clear</p>
            )}
          <Link href="/dashboard/retention" className="inline-block mt-2">
            <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200 gap-1">
              Open Retention <ChevronRight className="w-3 h-3" />
            </Button>
          </Link>
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Revenue Intelligence
          </h2>
          <ul className="space-y-1 text-sm text-neutral-300">
            <li>Proposal→Accepted: {(ri.proposalSentToAcceptedRate ?? 0) * 100}%</li>
            <li>Accepted→Delivery: {(ri.acceptedToDeliveryStartedRate ?? 0) * 100}%</li>
            <li>Delivery→Proof: {(ri.deliveryCompletedToProofRate ?? 0) * 100}%</li>
            <li>Delivered value (wk): ${(ri.deliveredValueThisWeek ?? 0).toLocaleString("en-US")}</li>
            {ri.topBottleneck && (
              <li className="text-amber-400">
                Top bottleneck: {ri.topBottleneck.label} ({ri.topBottleneck.count})
              </li>
            )}
          </ul>
          <Link href="/dashboard/intelligence" className="inline-block mt-2">
            <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200 gap-1">
              Open Intelligence <ChevronRight className="w-3 h-3" />
            </Button>
          </Link>
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Operator + Forecast
          </h2>
          {(() => {
            const of = d.operatorForecast;
            if (!of) return <p className="text-xs text-neutral-500">Loading…</p>;
            const hasData = of.weeklyScore != null || of.monthlyScore != null;
            if (!hasData) return <p className="text-xs text-neutral-500">No data yet</p>;
            return (
              <ul className="space-y-1 text-sm text-neutral-300">
                {of.weeklyScore != null && (
                  <li>Weekly score: {of.weeklyScore} ({of.weeklyGrade ?? "—"})</li>
                )}
                {of.monthlyScore != null && (
                  <li>Monthly score: {of.monthlyScore} ({of.monthlyGrade ?? "—"})</li>
                )}
                {of.behindPaceWarning && (
                  <li className="text-amber-400">{of.behindPaceWarning}</li>
                )}
                {of.deliveredValueProjectedMonth != null && (
                  <li>Delivered value projected (mo): ${of.deliveredValueProjectedMonth.toLocaleString("en-US")}</li>
                )}
              </ul>
            );
          })()}
          <div className="flex gap-2 mt-2">
            <Link href="/dashboard/operator">
              <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200 gap-1">
                Operator Score <ChevronRight className="w-3 h-3" />
              </Button>
            </Link>
            <Link href="/dashboard/forecast">
              <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200 gap-1">
                Forecast <ChevronRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Reminders + Automation
          </h2>
          {(() => {
            const ra = d.remindersAutomation;
            if (!ra) return <p className="text-xs text-neutral-500">Loading…</p>;
            const hasData = (ra.remindersOverdue ?? 0) > 0 || (ra.remindersDueToday ?? 0) > 0 || (ra.remindersHighPriority ?? 0) > 0 || (ra.suggestionsPending ?? 0) > 0 || ra.bestNextAction;
            if (!hasData) return <p className="text-xs text-neutral-500">All clear</p>;
            return (
              <ul className="space-y-1 text-sm text-neutral-300">
                {(ra.remindersOverdue ?? 0) > 0 && (
                  <li className="text-red-400">{ra.remindersOverdue} overdue</li>
                )}
                {(ra.remindersDueToday ?? 0) > 0 && (
                  <li className="text-amber-400">{ra.remindersDueToday} due today</li>
                )}
                {(ra.remindersHighPriority ?? 0) > 0 && (
                  <li>{ra.remindersHighPriority} high priority</li>
                )}
                {(ra.suggestionsPending ?? 0) > 0 && (
                  <li>{ra.suggestionsPending} pending suggestions</li>
                )}
                {ra.bestNextAction && (
                  <li>
                    <Link href={ra.bestNextAction.url} className="text-amber-400 hover:underline">
                      Next: {ra.bestNextAction.title}
                    </Link>
                  </li>
                )}
              </ul>
            );
          })()}
          <div className="flex gap-2 mt-2">
            <Link href="/dashboard/reminders">
              <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200 gap-1">
                Reminders <ChevronRight className="w-3 h-3" />
              </Button>
            </Link>
            <Link href="/dashboard/automation">
              <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200 gap-1">
                Automation <ChevronRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Jobs
          </h2>
          {(() => {
            const js = d.jobsSummary;
            if (!js) return <p className="text-xs text-neutral-500">Loading…</p>;
            const hasJobs = (js.queued ?? 0) > 0 || (js.running ?? 0) > 0 || (js.failed ?? 0) > 0 || (js.deadLetter ?? 0) > 0 || (js.succeeded24h ?? 0) > 0 || (js.staleRunning ?? 0) > 0 || (js.dueSchedules ?? 0) > 0;
            if (!hasJobs) return <p className="text-xs text-neutral-500">No jobs</p>;
            return (
              <ul className="space-y-1 text-sm text-neutral-300">
                {(js.queued ?? 0) > 0 && <li>{(js.queued ?? 0)} queued</li>}
                {(js.running ?? 0) > 0 && <li className="text-blue-400">{(js.running ?? 0)} running</li>}
                {(js.failed ?? 0) > 0 && (
                  <li className="text-red-400">
                    {(js.failed ?? 0)} failed
                    {js.latestFailedJobType && ` (latest: ${js.latestFailedJobType})`}
                  </li>
                )}
                {(js.deadLetter ?? 0) > 0 && (
                  <li>
                    <Link href="/dashboard/jobs?status=dead_letter" className="text-red-600 hover:underline">
                      {(js.deadLetter ?? 0)} dead-letter
                    </Link>
                  </li>
                )}
                {(js.staleRunning ?? 0) > 0 && <li className="text-amber-400">{(js.staleRunning ?? 0)} stale</li>}
                {(js.dueSchedules ?? 0) > 0 && <li className="text-amber-400">{(js.dueSchedules ?? 0)} schedules due</li>}
                {(js.succeeded24h ?? 0) > 0 && <li className="text-emerald-400">{(js.succeeded24h ?? 0)} succeeded (24h)</li>}
              </ul>
            );
          })()}
          <div className="flex gap-2 mt-2">
            <Link href="/dashboard/jobs">
              <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200 gap-1">
                Open Jobs <ChevronRight className="w-3 h-3" />
              </Button>
            </Link>
            <Link href="/dashboard/job-schedules">
              <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200 gap-1">
                Schedules
              </Button>
            </Link>
          </div>
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
            <Plug className="w-4 h-4" />
            Integration Health
          </h2>
          <div className="flex flex-wrap gap-2 text-xs mb-2">
            {(ih.byMode?.live ?? 0) > 0 && (
              <Badge variant="success" className="text-xs">LIVE {ih.byMode.live}</Badge>
            )}
            {(ih.byMode?.manual ?? 0) > 0 && (
              <Badge variant="outline" className="text-xs">MANUAL {ih.byMode.manual}</Badge>
            )}
            {(ih.byMode?.mock ?? 0) > 0 && (
              <Badge variant="outline" className="text-xs">MOCK {ih.byMode.mock}</Badge>
            )}
            {(ih.byMode?.off ?? 0) > 0 && (
              <Badge variant="outline" className="text-xs">OFF {ih.byMode.off}</Badge>
            )}
          </div>
          {(ih.errorCount ?? 0) > 0 && (
            <p className="text-xs text-red-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {ih.errorCount} with errors
            </p>
          )}
          <Link href="/dashboard/settings" className="inline-block mt-2">
            <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200">
              Open Settings
            </Button>
          </Link>
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Observability + Audit
          </h2>
          <div className="grid grid-cols-2 gap-2 text-sm mb-2">
            <div>
              <span className="text-neutral-500">Errors today:</span>{" "}
              <span className={d.observability?.errorsToday ? "text-red-400 font-medium" : "text-neutral-300"}>
                {d.observability?.errorsToday ?? 0}
              </span>
            </div>
            <div>
              <span className="text-neutral-500">Slow events:</span>{" "}
              <span className={d.observability?.slowEventsToday ? "text-amber-400 font-medium" : "text-neutral-300"}>
                {d.observability?.slowEventsToday ?? 0}
              </span>
            </div>
            <div>
              <span className="text-neutral-500">Last error:</span>{" "}
              <span className="text-neutral-400">
                {d.observability?.lastErrorAt
                  ? new Date(d.observability.lastErrorAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                  : "—"}
              </span>
            </div>
            <div>
              <span className="text-neutral-500">Actions today:</span>{" "}
              <span className="text-neutral-300">{d.auditSummary?.actionsToday ?? 0}</span>
            </div>
            {d.observability?.topFailingAction && (
              <div className="col-span-2 text-xs text-red-400 truncate">
                Top failing: {d.observability.topFailingAction}
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-2">
            <Link href="/dashboard/observability">
              <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200">
                Observability
              </Button>
            </Link>
            <Link href="/dashboard/audit">
              <Button variant="ghost" size="sm" className="text-amber-300 hover:text-amber-200">
                Audit
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
