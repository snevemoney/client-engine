"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRetryableFetch } from "@/hooks/useRetryableFetch";
import { AsyncState } from "@/components/ui/AsyncState";

type QuarterData = {
  id: string | null;
  startsAt: string;
  endsAt: string;
  title: string;
  notes: string | null;
  kpis?: Array<{ id: string; key: string; label: string; targetValue: number; currentValue: number | null; unit: string }>;
};

type WeekData = {
  week: { id: string | null; weekStart: string; weekEnd: string; focusConstraint: string | null };
  plan: { topOutcomes: unknown[]; milestones: unknown[]; commitments: unknown[] };
  review: { wins: unknown[]; misses: unknown[]; deltas: unknown[]; decisions: unknown[]; retroNotes: string | null };
};

function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${start.toLocaleDateString("en-CA", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}`;
}

export default function FounderOSPage() {
  const {
    data: quarter,
    loading: quarterLoading,
    error: quarterError,
    refetch: refetchQuarter,
  } = useRetryableFetch<QuarterData>("/api/internal/founder/os/quarter");

  const {
    data: currentWeek,
    loading: weekLoading,
    error: weekError,
    refetch: refetchWeek,
  } = useRetryableFetch<WeekData>("/api/internal/founder/os/week");

  const loading = quarterLoading || weekLoading;
  const error = quarterError || weekError;

  const refetchAll = useCallback(() => {
    refetchQuarter();
    refetchWeek();
  }, [refetchQuarter, refetchWeek]);

  const weekHasPlan = (currentWeek?.plan.topOutcomes?.length ?? 0) > 0;
  const weekHasReview = (currentWeek?.review.wins?.length ?? 0) > 0 || (currentWeek?.review.misses?.length ?? 0) > 0;

  return (
    <div className="space-y-6" data-testid="founder-os-hub">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Founder OS</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Quarterly goals, weekly plan, and review cadence.
        </p>
      </div>

      <AsyncState loading={loading} error={error} onRetry={refetchAll}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Current Quarter */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
            <h2 className="text-sm font-medium text-amber-400/90 mb-3">Current Quarter</h2>
            {quarter ? (
              <div className="text-sm space-y-2">
                <p>
                  <span className="text-neutral-500">{quarter.title}</span>
                  <span className="text-neutral-400 ml-2">
                    {quarter.startsAt.slice(0, 10)} – {quarter.endsAt.slice(0, 10)}
                  </span>
                </p>
                {quarter.kpis && quarter.kpis.length > 0 && (
                  <ul className="text-xs space-y-1">
                    {quarter.kpis.slice(0, 3).map((k) => (
                      <li key={k.id}>
                        {k.label}: {k.currentValue ?? "—"} / {k.targetValue} {k.unit}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2 mt-3">
                  <Link
                    href="/dashboard/founder/os/quarter"
                    className="text-xs px-2 py-1 rounded border border-neutral-600 hover:bg-neutral-800 text-amber-400"
                  >
                    Edit quarter
                  </Link>
                  <Link
                    href="/dashboard/founder/os/quarter"
                    className="text-xs px-2 py-1 rounded border border-neutral-600 hover:bg-neutral-800 text-amber-400"
                  >
                    Edit KPIs
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-xs text-neutral-500">No quarter data.</p>
            )}
          </div>

          {/* Current Week */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
            <h2 className="text-sm font-medium text-amber-400/90 mb-3">Current Week</h2>
            {currentWeek ? (
              <div className="text-sm space-y-2">
                <p className="text-neutral-400">
                  {formatWeekRange(currentWeek.week.weekStart)}
                </p>
                <p className="text-xs">
                  Plan: {weekHasPlan ? "✓" : "—"} | Review: {weekHasReview ? "✓" : "—"}
                </p>
                <div className="flex gap-2 mt-3">
                  <Link
                    href="/dashboard/founder/os/week"
                    className="text-xs px-2 py-1 rounded border border-neutral-600 hover:bg-neutral-800 text-amber-400"
                  >
                    Open this week
                  </Link>
                  <Link
                    href="/dashboard/founder/os/week?generate=1"
                    data-testid="founder-os-generate-suggestions"
                    className="text-xs px-2 py-1 rounded border border-neutral-600 hover:bg-neutral-800 text-amber-400"
                  >
                    Generate suggestions
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-xs text-neutral-500">Loading…</p>
            )}
          </div>
        </div>
      </AsyncState>

      <div className="flex gap-2">
        <Link
          href="/dashboard/founder"
          className="text-sm text-amber-400 hover:underline"
        >
          ← Founder Mode
        </Link>
      </div>
    </div>
  );
}
