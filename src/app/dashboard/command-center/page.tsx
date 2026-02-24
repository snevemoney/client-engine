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
  };
  deliveryOps?: {
    dueSoon: number;
    overdue: number;
    proofRequestedPending: number;
    completedNoProofCandidate: number;
  };
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

export default function CommandCenterPage() {
  const [data, setData] = useState<CommandCenterData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/command-center")
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
    proposalActions: { readyNotSent: 0, sentNoResponseOver7d: 0, acceptedNoProject: 0, draftsIncomplete: 0 },
    deliveryOps: { dueSoon: 0, overdue: 0, proofRequestedPending: 0, completedNoProofCandidate: 0 },
  };

  const fp = d.followupQueue ?? { followupsOverdue: 0, followupsDueToday: 0, followupsUpcoming: 0 };
  const ia = d.intakeActions ?? {};
  const pg = d.proofGaps ?? {};
  const ih = d.integrationHealth ?? { byMode: { off: 0, mock: 0, manual: 0, live: 0 }, errorCount: 0, total: 0 };
  const pa = d.proposalActions ?? { readyNotSent: 0, sentNoResponseOver7d: 0, acceptedNoProject: 0, draftsIncomplete: 0 };
  const do_ = d.deliveryOps ?? { dueSoon: 0, overdue: 0, proofRequestedPending: 0, completedNoProofCandidate: 0 };

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
      </div>
    </div>
  );
}
