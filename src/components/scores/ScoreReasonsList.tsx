/**
 * Phase 3.2: Top reasons list (ordered most negative impact first).
 */
type Reason = { label: string; impact: number; direction: string };

export function ScoreReasonsList({ reasons }: { reasons: Reason[] }) {
  if (reasons.length === 0) return null;
  return (
    <div
      className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4"
      data-testid="score-reasons"
    >
      <h2 className="text-sm font-medium text-neutral-300 mb-3">Top reasons</h2>
      <ol className="list-decimal list-inside space-y-1 text-sm">
        {reasons.map((r, i) => (
          <li key={`${r.label}-${i}`}>
            {r.label}
            <span className="text-neutral-500 ml-1">
              ({r.direction}, impact {r.impact >= 0 ? "+" : ""}{r.impact.toFixed(1)})
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
