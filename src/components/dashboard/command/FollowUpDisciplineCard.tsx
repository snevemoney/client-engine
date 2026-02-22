"use client";

import Link from "next/link";
import type { FollowUpDisciplineMetrics } from "@/lib/ops/types";

export function FollowUpDisciplineCard({ data }: { data: FollowUpDisciplineMetrics | null }) {
  if (!data) {
    return (
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-2">Follow-up discipline</h2>
        <p className="text-xs text-neutral-500">Loading…</p>
      </section>
    );
  }

  const {
    followUpsDueToday,
    overdueCount,
    noTouchIn7DaysCount,
    avgTouchesBeforeClose,
    avgTouchesOnActive,
    touched7PlusNotWonCount,
    status,
    overdueLeads,
  } = data;

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-neutral-300">Follow-up discipline</h2>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded ${
            status === "leak"
              ? "bg-amber-900/50 text-amber-200 border border-amber-700/50"
              : "bg-emerald-900/30 text-emerald-200 border border-emerald-700/30"
          }`}
        >
          {status === "leak" ? "Leak: Follow-up" : "Discipline OK"}
        </span>
      </div>
      <div className="grid gap-x-4 gap-y-1 grid-cols-2 text-sm mb-3">
        <div className="flex justify-between gap-2">
          <span className="text-neutral-500">Due today</span>
          <span className="text-neutral-200 font-medium tabular-nums">{followUpsDueToday}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-neutral-500">Overdue</span>
          <span className={overdueCount > 0 ? "text-amber-300 font-medium tabular-nums" : "text-neutral-200 font-medium tabular-nums"}>
            {overdueCount}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-neutral-500">No touch in 7+ days</span>
          <span className={noTouchIn7DaysCount > 0 ? "text-amber-300 font-medium tabular-nums" : "text-neutral-200 font-medium tabular-nums"}>
            {noTouchIn7DaysCount}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-neutral-500">Avg touches to close</span>
          <span className="text-neutral-200 font-medium tabular-nums">
            {avgTouchesBeforeClose != null ? avgTouchesBeforeClose : "—"}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-neutral-500">Avg touches (active)</span>
          <span className="text-neutral-200 font-medium tabular-nums">
            {avgTouchesOnActive != null ? avgTouchesOnActive : "—"}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-neutral-500">7+ touches, not won</span>
          <span className="text-neutral-200 font-medium tabular-nums">{touched7PlusNotWonCount}</span>
        </div>
      </div>
      {overdueLeads.length > 0 && (
        <div className="border-t border-neutral-700 pt-2 mt-2">
          <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1.5">Overdue (top)</p>
          <ul className="space-y-1 text-sm">
            {overdueLeads.slice(0, 5).map((l) => (
              <li key={l.id}>
                <Link
                  href={`/dashboard/leads/${l.id}`}
                  className="text-emerald-400 hover:text-emerald-300 hover:underline"
                >
                  {l.title}
                </Link>
                <span className="text-neutral-500 ml-1">({l.daysOverdue}d)</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
