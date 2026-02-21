import Link from "next/link";
import { Flag } from "lucide-react";

type GraduationTriggerCardProps = {
  dealsWon90d: number;
  targetWins: number | null;
  milestone: string | null;
};

export function GraduationTriggerCard({
  dealsWon90d,
  targetWins,
  milestone,
}: GraduationTriggerCardProps) {
  const target = targetWins ?? 10;
  const pct = target > 0 ? Math.min(100, Math.round((dealsWon90d / target) * 100)) : 0;

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium text-neutral-300 flex items-center gap-2">
          <Flag className="w-4 h-4 text-neutral-500" />
          Graduation trigger
        </h2>
        <Link
          href="/dashboard/settings"
          className="text-xs text-neutral-500 hover:text-neutral-300"
        >
          Set target
        </Link>
      </div>
      <p className="text-xs text-neutral-500 mb-2">
        Repeatable wins (90d) — don’t freelancing-loop forever.
      </p>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums text-neutral-200">
          {dealsWon90d}
        </span>
        <span className="text-neutral-500 text-sm">/ {target}</span>
        <span className="text-neutral-500 text-xs">({pct}%)</span>
      </div>
      {milestone && (
        <p className="text-xs text-neutral-400 mt-2 pt-2 border-t border-neutral-800">
          Next: {milestone}
        </p>
      )}
    </section>
  );
}
