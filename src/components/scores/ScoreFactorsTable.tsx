/**
 * Phase 3.2: Factor breakdown table.
 */
type Factor = {
  key: string;
  label: string;
  weight: number;
  normalizedValue: number;
  impact: number;
  reason?: string;
};

export function ScoreFactorsTable({ factors }: { factors: Factor[] }) {
  if (factors.length === 0) return null;
  return (
    <div
      className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 overflow-x-auto"
      data-testid="score-factors"
    >
      <h2 className="text-sm font-medium text-neutral-300 mb-3">Factor breakdown</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-neutral-500">
            <th className="pb-2 pr-4">Factor</th>
            <th className="pb-2 pr-4">Weight</th>
            <th className="pb-2 pr-4">Normalized</th>
            <th className="pb-2 pr-4">Impact</th>
            <th className="pb-2">Notes</th>
          </tr>
        </thead>
        <tbody>
          {factors.map((f) => (
            <tr key={f.key} className="border-t border-neutral-800">
              <td className="py-1.5 pr-4">{f.label}</td>
              <td className="py-1.5 pr-4">{f.weight}</td>
              <td className="py-1.5 pr-4">{f.normalizedValue.toFixed(0)}</td>
              <td className="py-1.5 pr-4">
                <span className={f.impact >= 0 ? "text-emerald-400" : "text-red-400"}>
                  {f.impact >= 0 ? "+" : ""}{f.impact.toFixed(1)}
                </span>
              </td>
              <td className="py-1.5 text-neutral-500">{f.reason ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
