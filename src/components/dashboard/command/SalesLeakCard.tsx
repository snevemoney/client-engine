import type { SalesLeakReport } from "@/lib/ops/types";

function formatWeekRange(weekStart: string, weekEnd: string): string {
  const s = new Date(weekStart);
  const e = new Date(weekEnd);
  return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

export function SalesLeakCard({ data }: { data: SalesLeakReport }) {
  const {
    stageCounts,
    worstLeakStage,
    worstLeakReason,
    weekStart,
    weekEnd,
    prospectingCount,
    newContactsMade,
    firstContactsSent,
    presentationsCount,
    followUpsDue,
    followUpsDone,
    referralAsksMade,
    referralLeadsReceived,
    relationshipTouches,
  } = data;

  const rows = [
    { label: "Prospecting count", value: prospectingCount },
    { label: "New contacts made", value: newContactsMade },
    { label: "First contacts sent", value: firstContactsSent },
    { label: "Presentations / calls", value: presentationsCount },
    { label: "Follow-ups due / done", value: `${followUpsDue} / ${followUpsDone}` },
    { label: "Referral asks made", value: referralAsksMade },
    { label: "Referral leads received", value: referralLeadsReceived },
    { label: "Relationship touches", value: relationshipTouches },
  ];

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-1">
        Sales Leak (This Week)
      </h2>
      <p className="text-xs text-neutral-500 mb-3">
        {formatWeekRange(weekStart, weekEnd)}
      </p>
      <div className="grid gap-x-6 gap-y-1 grid-cols-2 text-sm mb-3">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-2">
            <span className="text-neutral-500">{r.label}</span>
            <span className="text-neutral-200 font-medium tabular-nums">{String(r.value)}</span>
          </div>
        ))}
      </div>
      <div className="rounded border border-amber-900/50 bg-amber-950/30 px-3 py-2">
        <p className="text-xs font-medium text-amber-200/90 uppercase tracking-wider">Leak</p>
        <p className="text-sm font-semibold text-amber-100">
          {worstLeakStage.replace(/_/g, " ")} — {worstLeakReason}
        </p>
      </div>
    </section>
  );
}
