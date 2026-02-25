"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatDateTimeSafe } from "@/lib/ui/date-safe";

type OpsStats = {
  eventsToday?: number;
  errorsToday?: number;
  slowEventsToday?: number;
  lastErrorAt?: string | null;
  topEventKeys?: { eventKey: string; count: number }[];
  topErrors?: { eventKey: string; count: number }[];
};

type AuditStats = {
  actionsToday?: number;
  promotionsThisWeek?: number;
  proposalsSentThisWeek?: number;
  deliveriesCompletedThisWeek?: number;
  proofsPromotedThisWeek?: number;
};

export function OpsObservabilityWeeklyStats() {
  const [opsStats, setOpsStats] = useState<OpsStats | null>(null);
  const [auditStats, setAuditStats] = useState<AuditStats | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/ops-events/summary").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/audit-actions/summary").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([ops, audit]) => {
        setOpsStats(ops && typeof ops === "object" ? ops : null);
        setAuditStats(audit && typeof audit === "object" ? audit : null);
      })
      .catch(() => {
        setOpsStats(null);
        setAuditStats(null);
      });
  }, []);

  const actionCount = (opsStats?.eventsToday ?? 0) + (auditStats?.actionsToday ?? 0);
  const errorCount = opsStats?.errorsToday ?? 0;
  const slowCount = opsStats?.slowEventsToday ?? 0;
  const topErrorKey = opsStats?.topErrors?.[0]?.eventKey ?? "";
  const topActionKey = opsStats?.topEventKeys?.[0]?.eventKey ?? "";
  const lastError = opsStats?.lastErrorAt ?? "";

  const hasAny =
    actionCount > 0 ||
    errorCount > 0 ||
    slowCount > 0 ||
    topErrorKey !== "" ||
    topActionKey !== "" ||
    lastError !== "";

  if (!hasAny) {
    return null;
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
        Ops Observability
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        {actionCount > 0 && (
          <span>
            Actions (today): <strong>{actionCount}</strong>
          </span>
        )}
        {errorCount > 0 && (
          <Link href="/dashboard/observability" className="text-red-400 hover:underline">
            Errors (today): <strong>{errorCount}</strong>
          </Link>
        )}
        {slowCount > 0 && (
          <Link href="/dashboard/observability?slow=1" className="text-amber-400 hover:underline">
            Slow events: <strong>{slowCount}</strong>
          </Link>
        )}
        {topErrorKey && (
          <span>
            Top error: <strong className="text-red-400">{topErrorKey}</strong>
          </span>
        )}
        {topActionKey && (
          <span>
            Top action: <strong>{topActionKey}</strong>
          </span>
        )}
        {lastError && (
          <span>
            Last error: <strong>{formatDateTimeSafe(lastError)}</strong>
          </span>
        )}
      </div>
      <div className="flex gap-2 mt-2">
        <Link href="/dashboard/observability" className="text-xs text-amber-400 hover:underline">
          Observability
        </Link>
        <Link href="/dashboard/audit" className="text-xs text-amber-400 hover:underline">
          Audit
        </Link>
      </div>
    </div>
  );
}
