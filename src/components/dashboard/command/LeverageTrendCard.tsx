"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, Save } from "lucide-react";

type Snapshot = {
  weekEnding: string;
  leverageScore: number;
  proposalWinRatePct: number | null;
  outcomesTrackedPct: number;
  dealsWon90d: number;
  bottleneckLabel: string | null;
};

export function LeverageTrendCard({ history }: { history: Snapshot[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/ops/weekly-snapshot", { method: "POST" });
      if (res.ok) router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium text-neutral-300 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-neutral-500" />
          Leverage trend (8 weeks)
        </h2>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="text-xs text-neutral-400 hover:text-neutral-200 disabled:opacity-50 flex items-center gap-1"
        >
          <Save className="w-3 h-3" /> {saving ? "Saving…" : "Save snapshot"}
        </button>
      </div>
      {history.length === 0 ? (
        <p className="text-xs text-neutral-500">
          Save a weekly snapshot to build the trend. Use at the end of each review.
        </p>
      ) : (
        <div className="space-y-1.5">
          {history.map((s) => (
            <div
              key={s.weekEnding}
              className="flex items-center justify-between text-xs gap-2"
            >
              <span className="text-neutral-500 w-20 shrink-0">{s.weekEnding}</span>
              <div className="flex-1 flex items-center gap-2">
                <div className="h-2 rounded bg-neutral-800 min-w-[60px] max-w-[100px] overflow-hidden flex-1">
                  <div
                    className="h-full rounded bg-neutral-500 transition-all"
                    style={{ width: `${Math.min(100, s.leverageScore)}%` }}
                  />
                </div>
                <span className="tabular-nums text-neutral-300 w-6">{s.leverageScore}</span>
              </div>
              {s.proposalWinRatePct != null && (
                <span className="text-neutral-500 tabular-nums w-8">{s.proposalWinRatePct}%</span>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
