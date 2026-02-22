"use client";

import Link from "next/link";
import type { FollowUpDisciplineMetrics } from "@/lib/ops/types";

export function FollowUpsDueCard({ data }: { data: FollowUpDisciplineMetrics | null }) {
  if (!data) {
    return (
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-2">Follow-ups due today</h2>
        <p className="text-xs text-neutral-500">Loading…</p>
      </section>
    );
  }

  const { dueTodayLeads, overdueLeads, followUpsDueToday, overdueCount } = data;
  const totalDue = dueTodayLeads.length + overdueLeads.length;
  const hasAny = totalDue > 0;

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-neutral-300">Follow-ups due today</h2>
        <span className="text-xs text-neutral-500 tabular-nums">
          {followUpsDueToday} due · {overdueCount} overdue
        </span>
      </div>
      {!hasAny ? (
        <p className="text-xs text-neutral-500">
          No follow-ups due today. Set <strong>Next contact</strong> on leads to see them here.
        </p>
      ) : (
        <ul className="space-y-2 text-sm">
          {overdueLeads.slice(0, 8).map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2">
              <Link
                href={`/dashboard/leads/${l.id}`}
                className="text-amber-300 hover:text-amber-200 hover:underline truncate min-w-0"
              >
                {l.title}
              </Link>
              <span className="text-xs text-amber-500/80 shrink-0">({l.daysOverdue}d overdue)</span>
            </li>
          ))}
          {dueTodayLeads.slice(0, Math.max(0, 12 - Math.min(overdueLeads.length, 8))).map((l) => (
            <li key={l.id}>
              <Link
                href={`/dashboard/leads/${l.id}`}
                className="text-emerald-400 hover:text-emerald-300 hover:underline"
              >
                {l.title}
              </Link>
              <span className="text-xs text-neutral-500 ml-1">
                {new Date(l.nextContactAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </li>
          ))}
        </ul>
      )}
      {hasAny && (
        <Link
          href="/dashboard/leads"
          className="text-xs text-neutral-400 hover:text-white mt-2 inline-block"
        >
          All leads →
        </Link>
      )}
    </section>
  );
}
