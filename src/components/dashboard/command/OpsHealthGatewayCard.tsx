"use client";

import Link from "next/link";
import { Activity, AlertTriangle, CheckCircle } from "lucide-react";

type OpsHealthSummary = {
  workdayStatus: "success" | "partial" | "fail" | "none";
  totalCount: number;
  approvalQueueCount: number;
};

export function OpsHealthGatewayCard({ summary }: { summary: OpsHealthSummary }) {
  const hasAttention = summary.totalCount > 0 || summary.workdayStatus === "fail" || summary.workdayStatus === "partial";
  const statusLabel =
    summary.workdayStatus === "success"
      ? "Run OK"
      : summary.workdayStatus === "partial"
        ? "Partial"
        : summary.workdayStatus === "fail"
          ? "Failed"
          : "No run";

  return (
    <section
      className={`rounded-lg border p-4 ${
        hasAttention
          ? "border-amber-900/40 bg-amber-950/20"
          : "border-neutral-800 bg-neutral-900/50"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-neutral-400" />
          <h2 className="text-sm font-medium text-neutral-300">Ops Health</h2>
          {hasAttention ? (
            <span className="inline-flex items-center gap-1 text-amber-400 text-xs">
              <AlertTriangle className="w-3.5 h-3.5" />
              {summary.totalCount} need attention
              {summary.approvalQueueCount > 0 && ` · ${summary.approvalQueueCount} in approval queue`}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-emerald-400/90 text-xs">
              <CheckCircle className="w-3.5 h-3.5" />
              {statusLabel}
            </span>
          )}
        </div>
        <Link
          href="/dashboard/ops-health"
          className="shrink-0 rounded-md bg-neutral-100 text-neutral-900 px-3 py-2 text-sm font-medium hover:bg-neutral-200"
        >
          View panel →
        </Link>
      </div>
      <p className="text-xs text-neutral-500 mt-1">
        Workday run: {statusLabel}. One panel for failures, stale leads, stuck proposals, approvals.
      </p>
    </section>
  );
}
