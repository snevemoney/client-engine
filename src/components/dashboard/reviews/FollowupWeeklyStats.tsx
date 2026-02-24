"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Summary = {
  followupsCompletedThisWeek?: number;
  followupsOverdue?: number;
  callsLoggedThisWeek?: number;
  emailsLoggedThisWeek?: number;
};

export function FollowupWeeklyStats() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    fetch("/api/followups/summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSummary(d && typeof d === "object" ? d : null))
      .catch(() => setSummary(null));
  }, []);

  const completed = summary?.followupsCompletedThisWeek ?? 0;
  const overdue = summary?.followupsOverdue ?? 0;
  const calls = summary?.callsLoggedThisWeek ?? 0;
  const emails = summary?.emailsLoggedThisWeek ?? 0;

  if (completed === 0 && overdue === 0 && calls === 0 && emails === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Follow-up execution (this week)</div>
      <div className="flex flex-wrap gap-4 text-sm">
        {completed > 0 && (
          <span className="text-emerald-400"><strong>{completed}</strong> completed</span>
        )}
        {overdue > 0 && (
          <Link href="/dashboard/followups" className="text-red-400 hover:underline">
            <strong>{overdue}</strong> overdue
          </Link>
        )}
        {calls > 0 && (
          <span><strong>{calls}</strong> calls logged</span>
        )}
        {emails > 0 && (
          <span><strong>{emails}</strong> emails logged</span>
        )}
      </div>
      <Link href="/dashboard/followups" className="inline-block mt-2 text-xs text-amber-400 hover:underline">
        Open follow-ups
      </Link>
    </div>
  );
}
