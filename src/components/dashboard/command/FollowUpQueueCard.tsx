"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

type QueueItem = {
  id: string;
  title: string;
  driverType: string | null;
  qualificationTotal: number;
  nextAction: string | null;
  nextActionDueAt: string | null;
  proposalSentAt: string | null;
};

type DriverSummary = {
  noNextAction: number;
  overdue: number;
  overdue3d?: number;
  proposalsNoFollowUp: number;
  noSalesActions7d?: boolean;
};

function getStatusBadge(dueAt: string | null): { label: string; variant: "destructive" | "warning" | "default" } {
  if (!dueAt) return { label: "No date", variant: "default" };
  const due = new Date(dueAt);
  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  if (due < now) return { label: "Overdue", variant: "destructive" };
  if (due <= todayEnd) return { label: "Due today", variant: "warning" };
  return { label: "Upcoming", variant: "default" };
}

export function FollowUpQueueCard() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [summary, setSummary] = useState<DriverSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/leads/followup-queue").then((r) => r.json()),
      fetch("/api/leads/driver-summary?range=7d").then((r) => r.json()),
    ]).then(([queueRes, summaryRes]) => {
      setItems(queueRes?.items ?? []);
      setSummary(summaryRes);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">Follow-Up Queue</h2>
        <p className="text-xs text-neutral-500">Loading…</p>
      </section>
    );
  }

  const warnings: string[] = [];
  if (summary?.noSalesActions7d) {
    warnings.push("No sales actions in 7 days");
  }
  if (summary?.noNextAction && summary.noNextAction > 0) {
    warnings.push(`${summary.noNextAction} lead(s) with no next action set`);
  }
  if (summary?.overdue3d && summary.overdue3d > 0) {
    warnings.push(`${summary.overdue3d} overdue > 3 days`);
  } else if (summary?.overdue && summary.overdue > 0) {
    warnings.push(`${summary.overdue} overdue follow-up(s)`);
  }
  if (summary?.proposalsNoFollowUp && summary.proposalsNoFollowUp > 0) {
    warnings.push(`${summary.proposalsNoFollowUp} proposal(s) sent but no follow-up due date`);
  }

  const highScoreNoAction = items.filter((i) => i.qualificationTotal >= 9 && !i.nextAction && !i.nextActionDueAt);
  if (highScoreNoAction.length > 0) {
    warnings.push(`${highScoreNoAction.length} high-priority lead(s) missing next action`);
  }

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-3">Follow-Up Queue</h2>

      {warnings.length > 0 && (
        <div className="mb-3 rounded border border-amber-900/40 bg-amber-950/20 px-3 py-2">
          <div className="flex items-center gap-2 text-amber-200/90 text-xs font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {warnings.join(" · ")}
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {items.slice(0, 15).map((item) => {
          const status = getStatusBadge(item.nextActionDueAt);
          return (
            <Link
              key={item.id}
              href={`/dashboard/leads/${item.id}`}
              className="block rounded-md border border-neutral-700/60 bg-neutral-800/40 p-2 text-sm hover:bg-neutral-800/60 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-neutral-200 truncate">{item.title}</span>
                <Badge variant={status.variant} className="shrink-0 text-[10px]">
                  {status.label}
                </Badge>
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-neutral-500">
                {item.driverType && (
                  <span className="capitalize">{item.driverType}</span>
                )}
                <span>Score: {item.qualificationTotal}/12</span>
                {item.nextAction && <span className="truncate max-w-[140px]">{item.nextAction}</span>}
                {item.nextActionDueAt && (
                  <span>{new Date(item.nextActionDueAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
      {items.length === 0 && (
        <p className="text-xs text-neutral-500">No leads in follow-up queue.</p>
      )}
      {items.length > 15 && (
        <Link href="/dashboard/leads" className="mt-2 block text-xs text-amber-300 hover:underline">
          View all ({items.length}) →
        </Link>
      )}
    </section>
  );
}
