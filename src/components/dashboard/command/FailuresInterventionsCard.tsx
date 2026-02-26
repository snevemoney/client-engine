import Link from "next/link";
import { AlertTriangle, Clock, FileCheck, UserCheck } from "lucide-react";
import type { FailuresAndInterventions } from "@/lib/ops/failuresInterventions";

export function FailuresInterventionsCard({ data }: { data: FailuresAndInterventions }) {
  const {
    failedPipelineRuns,
    staleLeads,
    stuckProposals,
    needsApproval,
    totalCount,
  } = data;

  if (totalCount === 0) {
    return (
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500/80" />
          Failures & interventions
        </h2>
        <p className="text-xs text-neutral-500">Nothing failed or stuck. No items needing approval.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-4">
      <h2 className="text-sm font-medium text-amber-200/90 mb-3 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        Failures & interventions
        <span className="text-xs font-normal text-amber-400/80">({totalCount} items)</span>
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {failedPipelineRuns.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Failed pipeline runs
            </h3>
            <ul className="space-y-1 text-sm">
              {failedPipelineRuns.slice(0, 5).map((e) => (
                <li key={e.runId}>
                  <Link
                    href={`/dashboard/leads/${e.leadId}`}
                    className="text-amber-200/90 hover:text-amber-100"
                  >
                    {e.leadTitle}
                  </Link>
                  <span className="text-neutral-500 text-xs ml-1">
                    {e.lastErrorCode ?? "error"}
                    {e.lastErrorAt ? ` · ${new Date(e.lastErrorAt).toLocaleString("en-US")}` : ""}
                  </span>
                </li>
              ))}
              {failedPipelineRuns.length > 5 && (
                <li className="text-xs text-neutral-500">+{failedPipelineRuns.length - 5} more</li>
              )}
            </ul>
          </div>
        )}
        {staleLeads.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Stale (no response &gt;7d)
            </h3>
            <ul className="space-y-1 text-sm">
              {staleLeads.slice(0, 5).map((l) => (
                <li key={l.leadId}>
                  <Link
                    href={`/dashboard/leads/${l.leadId}`}
                    className="text-amber-200/90 hover:text-amber-100"
                  >
                    {l.leadTitle}
                  </Link>
                  <span className="text-neutral-500 text-xs ml-1">{l.daysSinceSent}d since sent</span>
                </li>
              ))}
              {staleLeads.length > 5 && (
                <li className="text-xs text-neutral-500">+{staleLeads.length - 5} more</li>
              )}
            </ul>
          </div>
        )}
        {stuckProposals.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <FileCheck className="w-3.5 h-3.5" /> Stuck proposals
            </h3>
            <ul className="space-y-1 text-sm">
              {stuckProposals.slice(0, 5).map((l) => (
                <li key={l.leadId}>
                  <Link
                    href={`/dashboard/leads/${l.leadId}`}
                    className="text-amber-200/90 hover:text-amber-100"
                  >
                    {l.leadTitle}
                  </Link>
                  <span className="text-neutral-500 text-xs ml-1">{l.daysStuck}d ready, not sent</span>
                </li>
              ))}
              {stuckProposals.length > 5 && (
                <li className="text-xs text-neutral-500">+{stuckProposals.length - 5} more</li>
              )}
            </ul>
          </div>
        )}
        {needsApproval.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5" /> Needs your approval
            </h3>
            <ul className="space-y-1 text-sm">
              {needsApproval.slice(0, 8).map((a) => (
                <li key={`${a.leadId}-${a.action}`}>
                  <Link
                    href={`/dashboard/leads/${a.leadId}`}
                    className="text-amber-200/90 hover:text-amber-100"
                  >
                    {a.leadTitle}
                  </Link>
                  <span className="text-neutral-500 text-xs ml-1">— {a.action}</span>
                </li>
              ))}
              {needsApproval.length > 8 && (
                <li className="text-xs text-neutral-500">+{needsApproval.length - 8} more</li>
              )}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
