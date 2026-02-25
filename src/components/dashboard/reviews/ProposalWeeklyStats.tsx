"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type ProposalWeeklyStats = {
  sentThisWeek?: number;
  acceptedThisWeek?: number;
  rejectedThisWeek?: number;
  readyNotSent?: number;
  sentNoResponseOver7d?: number;
  followupsCompletedThisWeek?: number;
  proposalEmailsThisWeek?: number;
  proposalCallsThisWeek?: number;
  meetingBookedThisWeek?: number;
  staleProposals?: number;
};

export function ProposalWeeklyStats() {
  const [stats, setStats] = useState<ProposalWeeklyStats | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/proposals/summary").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/proposals/gaps-summary").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/proposals/followup-summary").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([sum, gaps, followup]) => {
        const s = {
          sentThisWeek: sum?.sentThisWeek ?? 0,
          acceptedThisWeek: sum?.acceptedThisWeek ?? 0,
          rejectedThisWeek: sum?.rejectedThisWeek ?? 0,
          readyNotSent: gaps?.readyNotSent ?? 0,
          sentNoResponseOver7d: gaps?.sentNoResponseOver7d ?? 0,
          followupsCompletedThisWeek: followup?.completedThisWeek ?? 0,
          proposalEmailsThisWeek: followup?.emailsThisWeek ?? 0,
          proposalCallsThisWeek: followup?.callsThisWeek ?? 0,
          meetingBookedThisWeek: followup?.meetingBookedThisWeek ?? 0,
          staleProposals: followup?.stale ?? 0,
        };
        setStats(s);
      })
      .catch(() => setStats(null));
  }, []);

  const hasAny =
    (stats?.sentThisWeek ?? 0) > 0 ||
    (stats?.acceptedThisWeek ?? 0) > 0 ||
    (stats?.rejectedThisWeek ?? 0) > 0 ||
    (stats?.readyNotSent ?? 0) > 0 ||
    (stats?.sentNoResponseOver7d ?? 0) > 0 ||
    (stats?.followupsCompletedThisWeek ?? 0) > 0 ||
    (stats?.proposalEmailsThisWeek ?? 0) > 0 ||
    (stats?.proposalCallsThisWeek ?? 0) > 0 ||
    (stats?.meetingBookedThisWeek ?? 0) > 0 ||
    (stats?.staleProposals ?? 0) > 0;

  if (!stats || !hasAny) {
    return null;
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Proposals this week</div>
      <div className="flex flex-wrap gap-4 text-sm">
        {(stats.sentThisWeek ?? 0) > 0 && (
          <span><strong>{stats.sentThisWeek}</strong> sent</span>
        )}
        {(stats.acceptedThisWeek ?? 0) > 0 && (
          <span className="text-emerald-400"><strong>{stats.acceptedThisWeek}</strong> accepted</span>
        )}
        {(stats.rejectedThisWeek ?? 0) > 0 && (
          <span className="text-neutral-400"><strong>{stats.rejectedThisWeek}</strong> rejected</span>
        )}
        {(stats.readyNotSent ?? 0) > 0 && (
          <Link href="/dashboard/proposals?status=ready" className="text-amber-400 hover:underline">
            <strong>{stats.readyNotSent}</strong> ready not sent
          </Link>
        )}
        {(stats.sentNoResponseOver7d ?? 0) > 0 && (
          <span className="text-amber-400"><strong>{stats.sentNoResponseOver7d}</strong> sent, no response &gt;7d</span>
        )}
        {(stats.followupsCompletedThisWeek ?? 0) > 0 && (
          <span><strong>{stats.followupsCompletedThisWeek}</strong> follow-ups done</span>
        )}
        {(stats.proposalEmailsThisWeek ?? 0) > 0 && (
          <span><strong>{stats.proposalEmailsThisWeek}</strong> emails</span>
        )}
        {(stats.proposalCallsThisWeek ?? 0) > 0 && (
          <span><strong>{stats.proposalCallsThisWeek}</strong> calls</span>
        )}
        {(stats.meetingBookedThisWeek ?? 0) > 0 && (
          <Link href="/dashboard/proposal-followups" className="text-emerald-400 hover:underline">
            <strong>{stats.meetingBookedThisWeek}</strong> meetings booked
          </Link>
        )}
        {(stats.staleProposals ?? 0) > 0 && (
          <Link href="/dashboard/proposal-followups?bucket=stale" className="text-red-400 hover:underline">
            <strong>{stats.staleProposals}</strong> stale
          </Link>
        )}
      </div>
    </div>
  );
}
