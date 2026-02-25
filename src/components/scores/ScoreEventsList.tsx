/**
 * Phase 3.2: Recent score events (threshold breach, sharp drop, recovery).
 */
type Event = {
  id: string;
  eventType: string;
  fromScore: number;
  toScore: number;
  delta: number;
  fromBand: string;
  toBand: string;
  createdAt: string;
};

export function ScoreEventsList({ events }: { events: Event[] }) {
  if (events.length === 0) return null;
  return (
    <div
      className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4"
      data-testid="score-events"
    >
      <h2 className="text-sm font-medium text-neutral-300 mb-3">Recent score events</h2>
      <div className="space-y-2">
        {events.map((e) => (
          <div key={e.id} className="text-sm">
            <span className="font-medium">{e.eventType}</span>{" "}
            {e.fromBand} → {e.toBand} ({e.fromScore} → {e.toScore},{" "}
            Δ{e.delta >= 0 ? "+" : ""}{e.delta})
            <span className="text-neutral-500 ml-2">
              {new Date(e.createdAt).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
