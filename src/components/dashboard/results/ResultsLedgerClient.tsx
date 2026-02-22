"use client";

import Link from "next/link";
import { Target, TrendingUp, Package, AlertCircle } from "lucide-react";
import type { ResultsLedgerEntry } from "@/lib/ops/resultsLedger";

export function ResultsLedgerClient({ entries }: { entries: ResultsLedgerEntry[] }) {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Results Ledger</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Active and delivered clients: target, baseline, current, delta, what worked/didn't, proof, next action.
        </p>
      </div>

      {entries.length === 0 ? (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6 text-center">
          <Target className="w-10 h-10 text-neutral-600 mx-auto mb-2" />
          <p className="text-neutral-400">No APPROVED / BUILDING / SHIPPED leads yet.</p>
          <p className="text-sm text-neutral-500 mt-1">When you have active or delivered clients, they appear here.</p>
          <Link href="/dashboard/leads" className="text-sm text-neutral-300 hover:underline mt-2 inline-block">
            View leads →
          </Link>
        </section>
      ) : (
        <ul className="space-y-4">
          {entries.map((e) => (
            <li key={e.leadId}>
              <Link
                href={`/dashboard/leads/${e.leadId}`}
                className="block rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 hover:bg-neutral-800/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h2 className="font-semibold text-neutral-200">{e.title}</h2>
                  <span className="text-xs font-medium text-neutral-500 uppercase shrink-0">{e.status}</span>
                </div>
                <div className="grid gap-2 text-sm">
                  {e.resultTarget && (
                    <div className="flex items-start gap-2 text-neutral-300">
                      <Target className="w-3.5 h-3.5 text-emerald-500/80 shrink-0 mt-0.5" />
                      <span>{e.resultTarget}</span>
                    </div>
                  )}
                  {e.baselineSummary && (
                    <div className="text-neutral-500 text-xs">Baseline: {e.baselineSummary}</div>
                  )}
                  {e.currentResult && (
                    <div className="flex items-start gap-2 text-neutral-400">
                      <TrendingUp className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>Current: {e.currentResult}</span>
                    </div>
                  )}
                  {e.delta && (
                    <div className="text-neutral-400 text-xs">Delta: {e.delta}</div>
                  )}
                  <div className="flex flex-wrap gap-3 text-xs text-neutral-500">
                    <span>{e.interventionsCount} intervention(s)</span>
                    <span>{e.outcomeEntriesCount} outcome entries</span>
                    <span>{e.proofCount} proof point(s)</span>
                    {e.outcomeConfidence && (
                      <span className="text-neutral-400">Confidence: {e.outcomeConfidence}</span>
                    )}
                  </div>
                  {(e.whatWorked || e.whatFailed) && (
                    <div className="border-t border-neutral-800 pt-2 mt-2 space-y-1 text-xs">
                      {e.whatWorked && (
                        <p className="text-emerald-400/90">What worked: {e.whatWorked}</p>
                      )}
                      {e.whatFailed && (
                        <p className="text-amber-400/90">What didn't: {e.whatFailed}</p>
                      )}
                    </div>
                  )}
                  {e.nextActionRecommendation && (
                    <div className="flex items-center gap-1 text-xs text-neutral-400 mt-1">
                      <AlertCircle className="w-3 h-3" />
                      Next: {e.nextActionRecommendation.replace(/_/g, " ")}
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 text-sm">
        <Link href="/dashboard/leads" className="text-neutral-400 hover:text-neutral-200">
          View leads →
        </Link>
        <Link href="/dashboard/command" className="text-neutral-400 hover:text-neutral-200">
          Command Center →
        </Link>
      </div>
    </div>
  );
}
