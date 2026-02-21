import Link from "next/link";
import type { ConstraintSnapshot } from "@/lib/ops/types";

export function ConstraintCard({ constraint }: { constraint: ConstraintSnapshot | null }) {
  if (!constraint) {
    return (
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-2">Constraint / Bottleneck</h2>
        <p className="text-xs text-neutral-500">No clear constraint from recent data. Pipeline may be balanced or empty.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-4">
      <h2 className="text-sm font-medium text-amber-200 mb-2">Constraint / Bottleneck</h2>
      <p className="text-sm text-amber-100/90 mb-2">{constraint.reason}</p>
      <ul className="text-xs text-amber-100/80 list-disc list-inside mb-2">
        {constraint.recommendedActions.map((a, i) => (
          <li key={i}>{a}</li>
        ))}
      </ul>
      <Link
        href="/dashboard/metrics"
        className="text-xs text-amber-300 hover:underline"
      >
        View metrics →
      </Link>
    </section>
  );
}
