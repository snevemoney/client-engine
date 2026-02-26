"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  FileCheck,
  Layers,
  UserCheck,
  Zap,
  XCircle,
} from "lucide-react";
import type { OpsHealth } from "@/lib/ops/opsHealth";

type IntegrationSummary = {
  total: number;
  done: number;
  partial: number;
  missing: number;
  backlog: number;
  read: number;
  write: number;
};

export function OpsHealthPanel({
  data,
  integrationSummary,
}: {
  data: OpsHealth;
  integrationSummary?: IntegrationSummary;
}) {
  const {
    workdayRun,
    failedJobs,
    staleLeadsCount,
    stuckProposalsCount,
    approvalQueueCount,
    integrationHealth,
    failuresAndInterventions,
  } = data;

  const statusColor =
    workdayRun.status === "success"
      ? "text-emerald-400"
      : workdayRun.status === "partial"
        ? "text-amber-400"
        : workdayRun.status === "fail"
          ? "text-red-400"
          : "text-neutral-500";
  const statusLabel =
    workdayRun.status === "success"
      ? "Success"
      : workdayRun.status === "partial"
        ? "Partial"
        : workdayRun.status === "fail"
          ? "Failed"
          : "No run yet";

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ops Health</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Single view: workday run, failures, stale/stuck items, approval queue, integrations. No silent failure.
        </p>
      </div>

      {/* Top summary strip */}
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">At a glance</h2>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          <div className="flex items-center gap-2">
            <Zap className={`w-5 h-5 ${statusColor}`} />
            <div>
              <p className="text-xs text-neutral-500">Workday run</p>
              <p className={`font-medium ${statusColor}`}>{statusLabel}</p>
              {workdayRun.lastRunAt && (
                <p className="text-xs text-neutral-500">
                  Last: {new Date(workdayRun.lastRunAt).toLocaleString("en-US")}
                </p>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Failed jobs</p>
            <p className="font-medium text-neutral-200">
              {failedJobs.last24h} (24h) / {failedJobs.last7d} (7d)
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Stale leads</p>
            <p className="font-medium text-neutral-200">{staleLeadsCount}</p>
            <span className="text-xs text-neutral-500">no activity &gt;7d</span>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Approval queue</p>
            <p className="font-medium text-neutral-200">{approvalQueueCount}</p>
            <span className="text-xs text-neutral-500">waiting on you</span>
          </div>
        </div>
        {workdayRun.warningNoSuccessIn24h && workdayRun.lastSuccessAt && (
          <div className="mt-3 rounded border border-amber-900/50 bg-amber-950/30 px-3 py-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <p className="text-sm text-amber-200">
              No successful workday run in over 24h. Last success:{" "}
              {new Date(workdayRun.lastSuccessAt).toLocaleString("en-US")}.
            </p>
          </div>
        )}
      </section>

      {/* Integration health */}
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">Integration health</h2>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2">
            {integrationHealth.db ? (
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
            <span className="text-neutral-400">DB</span>
            <span className={integrationHealth.db ? "text-emerald-400" : "text-red-400"}>
              {integrationHealth.db ? "Connected" : "Error"}
            </span>
          </li>
          <li className="flex items-center gap-2">
            {integrationHealth.auth ? (
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            ) : (
              <XCircle className="w-4 h-4 text-amber-500" />
            )}
            <span className="text-neutral-400">Auth (NEXTAUTH_URL, AUTH_SECRET)</span>
            <span className={integrationHealth.auth ? "text-emerald-400" : "text-amber-400"}>
              {integrationHealth.auth ? "Set" : "Missing"}
            </span>
          </li>
          <li className="flex items-center gap-2">
            {integrationHealth.research.ok ? (
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            )}
            <span className="text-neutral-400">Research / workday</span>
            <span className="text-neutral-500">{integrationHealth.research.message}</span>
          </li>
          <li className="flex items-center gap-2">
            {integrationHealth.knowledge.ok ? (
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            )}
            <span className="text-neutral-400">Knowledge</span>
            <span className="text-neutral-500">{integrationHealth.knowledge.message}</span>
          </li>
        </ul>
      </section>

      {/* Failures & Interventions — single aggregated card */}
      <section className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-4">
        <h2 className="text-sm font-medium text-amber-200/90 mb-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Failures & interventions
          <span className="text-xs font-normal text-amber-400/80">
            ({failuresAndInterventions.totalCount} items)
          </span>
        </h2>
        <p className="text-sm text-amber-100/90 mb-3 font-medium">
          {failuresAndInterventions.recommendedNextAction}
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {failuresAndInterventions.failed.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Failed runs
              </h3>
              <ul className="space-y-1 text-sm">
                {failuresAndInterventions.failed.slice(0, 5).map((e) => (
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
                {failuresAndInterventions.failed.length > 5 && (
                  <li className="text-xs text-neutral-500">+{failuresAndInterventions.failed.length - 5} more</li>
                )}
              </ul>
            </div>
          )}
          {failuresAndInterventions.blocked.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Blocked / stuck
              </h3>
              <ul className="space-y-1 text-sm">
                {failuresAndInterventions.blocked.slice(0, 5).map((b, i) => (
                  <li key={`${b.leadId}-${i}`}>
                    <Link
                      href={`/dashboard/leads/${b.leadId}`}
                      className="text-amber-200/90 hover:text-amber-100"
                    >
                      {b.leadTitle}
                    </Link>
                    <span className="text-neutral-500 text-xs ml-1">
                      {b.kind === "stale" ? `${b.days}d no response` : `${b.days}d ready, not sent`}
                    </span>
                  </li>
                ))}
                {failuresAndInterventions.blocked.length > 5 && (
                  <li className="text-xs text-neutral-500">+{failuresAndInterventions.blocked.length - 5} more</li>
                )}
              </ul>
            </div>
          )}
          {failuresAndInterventions.needsIntervention.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5" /> Needs your approval
              </h3>
              <ul className="space-y-1 text-sm">
                {failuresAndInterventions.needsIntervention.slice(0, 8).map((a) => (
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
                {failuresAndInterventions.needsIntervention.length > 8 && (
                  <li className="text-xs text-neutral-500">+{failuresAndInterventions.needsIntervention.length - 8} more</li>
                )}
              </ul>
            </div>
          )}
        </div>
        {failuresAndInterventions.totalCount === 0 && (
          <p className="text-xs text-neutral-500">Nothing failed or stuck. No items needing approval.</p>
        )}
        <div className="mt-3 flex gap-2">
          <Link
            href="/dashboard/metrics"
            className="text-xs text-amber-300 hover:underline"
          >
            View metrics →
          </Link>
          <Link
            href="/dashboard/command"
            className="text-xs text-amber-300 hover:underline"
          >
            Command Center →
          </Link>
        </div>
      </section>

      {/* Stuck proposals count (redundant but explicit) */}
      {(stuckProposalsCount > 0 || approvalQueueCount > 0) && (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-neutral-300 mb-2">Quick counts</h2>
          <div className="flex gap-4 text-sm">
            {stuckProposalsCount > 0 && (
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-amber-500" />
                <span>{stuckProposalsCount} stuck proposal(s)</span>
                <span className="text-neutral-500">(drafted &gt;5d, not sent)</span>
              </div>
            )}
            {approvalQueueCount > 0 && (
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-amber-500" />
                <span>{approvalQueueCount} in approval queue</span>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
