"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type ExecutionAssistStats = {
  remindersCompletedThisWeek?: number;
  remindersOverdue?: number;
  suggestionsAppliedThisWeek?: number;
  topReminderKind?: string | null;
  topSuggestionType?: string | null;
};

export function ExecutionAssistWeeklyStats() {
  const [stats, setStats] = useState<ExecutionAssistStats | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/reminders/summary").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/automation-suggestions/summary").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/reminders?status=done&limit=50").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/reminders?status=open&limit=50").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/automation-suggestions?status=applied&limit=50").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([remSummary, autoSummary, doneReminders, openReminders, appliedSuggestions]) => {
        const kindCounts: Record<string, number> = {};
        for (const r of openReminders?.reminders ?? []) {
          const k = r.kind ?? "unknown";
          kindCounts[k] = (kindCounts[k] ?? 0) + 1;
        }
        const topKind = Object.entries(kindCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

        const typeCounts: Record<string, number> = {};
        for (const s of appliedSuggestions?.suggestions ?? []) {
          const t = s.type ?? "unknown";
          typeCounts[t] = (typeCounts[t] ?? 0) + 1;
        }
        const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

        setStats({
          remindersCompletedThisWeek: remSummary?.doneThisWeek ?? 0,
          remindersOverdue: remSummary?.overdue ?? 0,
          suggestionsAppliedThisWeek: autoSummary?.appliedThisWeek ?? 0,
          topReminderKind: topKind,
          topSuggestionType: topType,
        });
      })
      .catch(() => setStats(null));
  }, []);

  const hasAny =
    (stats?.remindersCompletedThisWeek ?? 0) > 0 ||
    (stats?.remindersOverdue ?? 0) > 0 ||
    (stats?.suggestionsAppliedThisWeek ?? 0) > 0 ||
    (stats?.topReminderKind ?? "") !== "" ||
    (stats?.topSuggestionType ?? "") !== "";

  if (!stats || !hasAny) {
    return null;
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Execution Assist</div>
      <div className="flex flex-wrap gap-4 text-sm">
        {(stats.remindersCompletedThisWeek ?? 0) > 0 && (
          <span>Reminders done (wk): <strong>{stats.remindersCompletedThisWeek}</strong></span>
        )}
        {(stats.remindersOverdue ?? 0) > 0 && (
          <Link href="/dashboard/reminders" className="text-amber-400 hover:underline">
            Overdue: <strong>{stats.remindersOverdue}</strong>
          </Link>
        )}
        {(stats.suggestionsAppliedThisWeek ?? 0) > 0 && (
          <span>Suggestions applied (wk): <strong>{stats.suggestionsAppliedThisWeek}</strong></span>
        )}
        {stats.topReminderKind && (
          <span>Top reminder kind: <strong>{stats.topReminderKind}</strong></span>
        )}
        {stats.topSuggestionType && (
          <span>Top suggestion type: <strong>{stats.topSuggestionType}</strong></span>
        )}
      </div>
      <div className="flex gap-2 mt-2">
        <Link href="/dashboard/reminders" className="text-xs text-amber-400 hover:underline">
          Reminders
        </Link>
        <Link href="/dashboard/automation" className="text-xs text-amber-400 hover:underline">
          Automation
        </Link>
      </div>
    </div>
  );
}
