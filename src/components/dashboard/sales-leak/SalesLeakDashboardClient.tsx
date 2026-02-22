"use client";

import Link from "next/link";
import { AlertTriangle, TrendingUp } from "lucide-react";
import type { SalesLeakDashboardData } from "@/lib/ops/salesLeakDashboard";

function formatWeekRange(weekStart: string, weekEnd: string): string {
  const s = new Date(weekStart);
  const e = new Date(weekEnd);
  return `${s.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${e.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

export function SalesLeakDashboardClient({ data }: { data: SalesLeakDashboardData }) {
  const { weekStart, weekEnd, stageCounts, stageLeaks, worstLeakStage, worstLeakReason, metrics, raw } = data;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sales Leak Dashboard</h1>
        <p className="text-sm text-neutral-400 mt-1">
          PBD-style: stages, conversion, leak detection with evidence. Where is the leak right now?
        </p>
        <p className="text-xs text-neutral-500 mt-0.5">{formatWeekRange(weekStart, weekEnd)}</p>
      </div>

      {/* Worst leak callout */}
      <section className="rounded-lg border border-amber-900/50 bg-amber-950/30 p-4">
        <h2 className="text-sm font-medium text-amber-200/90 flex items-center gap-2 mb-1">
          <AlertTriangle className="w-4 h-4" />
          Leak focus
        </h2>
        <p className="text-lg font-semibold text-amber-100">
          {worstLeakStage.replace(/_/g, " ")} — {worstLeakReason}
        </p>
      </section>

      {/* Stage counts */}
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">Stage counts (this week)</h2>
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
          {Object.entries(stageCounts).map(([stage, v]) => (
            <div key={stage} className="rounded border border-neutral-700/80 px-3 py-2">
              <p className="text-xs text-neutral-500 uppercase tracking-wider">{stage.replace(/_/g, " ")}</p>
              <p className="text-lg font-semibold text-neutral-200">{v.in}</p>
              {(v.due != null || v.done != null) && (
                <p className="text-xs text-neutral-500">due: {v.due ?? 0} · done: {v.done ?? 0}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Leak detection per stage */}
      {stageLeaks.length > 0 && (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-neutral-300 mb-3">Leak detection by stage</h2>
          <p className="text-xs text-neutral-500 mb-3">Current conversion vs target (placeholder targets; editable later)</p>
          <ul className="space-y-2">
            {stageLeaks.map((row) => (
              <li
                key={row.stage}
                className={`flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 ${
                  row.leak ? "border-amber-800 bg-amber-950/20" : "border-neutral-700/80"
                }`}
              >
                <div>
                  <span className="font-medium text-neutral-200">{row.label}</span>
                  <span className="text-neutral-500 text-sm ml-2">({row.inStage} in stage)</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-neutral-400">
                    {row.currentConversion}% vs target {row.targetConversion}%
                  </span>
                  {row.leak && (
                    <span className="inline-flex items-center gap-1 text-amber-400">
                      <AlertTriangle className="w-3.5 h-3.5" /> Leak
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-500 w-full mt-1">{row.evidence}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Aggregate metrics */}
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Metrics
        </h2>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 text-sm">
          <div>
            <p className="text-xs text-neutral-500">New leads (week)</p>
            <p className="font-semibold text-neutral-200">{metrics.newLeadsWeekly}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Contacted</p>
            <p className="font-semibold text-neutral-200">{metrics.contactedLeads}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Proposals sent (90d)</p>
            <p className="font-semibold text-neutral-200">{metrics.proposalsSent}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Proposal close rate</p>
            <p className="font-semibold text-neutral-200">
              {metrics.proposalCloseRatePct != null ? `${metrics.proposalCloseRatePct}%` : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Avg follow-ups before close</p>
            <p className="font-semibold text-neutral-200">
              {metrics.avgFollowUpCountBeforeClose ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">No-response (sent &gt;14d)</p>
            <p className="font-semibold text-neutral-200">{metrics.noResponseLeadsCount}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Referrals requested</p>
            <p className="font-semibold text-neutral-200">{raw.referralAsksMade}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Referrals received</p>
            <p className="font-semibold text-neutral-200">{raw.referralLeadsReceived}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Lead → proposal (median days)</p>
            <p className="font-semibold text-neutral-200">
              {metrics.timeLeadToProposalMedianDays != null
                ? Math.round(metrics.timeLeadToProposalMedianDays)
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Proposal → close (median days)</p>
            <p className="font-semibold text-neutral-200">
              {metrics.timeProposalToCloseMedianDays != null
                ? Math.round(metrics.timeProposalToCloseMedianDays)
                : "—"}
            </p>
          </div>
        </div>
        <p className="text-xs text-neutral-500 mt-2">Reply rate, meetings booked, repeat work: not yet tracked (placeholder).</p>
      </section>

      <div className="flex gap-2">
        <Link href="/dashboard/leads" className="text-sm text-neutral-400 hover:text-neutral-200">
          View leads →
        </Link>
        <Link href="/dashboard/command" className="text-sm text-neutral-400 hover:text-neutral-200">
          Command Center →
        </Link>
      </div>
    </div>
  );
}
