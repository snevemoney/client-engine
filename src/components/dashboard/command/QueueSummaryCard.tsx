import type { QueueSummary } from "@/lib/ops/queueSummary";

export function QueueSummaryCard({ queue }: { queue: QueueSummary }) {
  const rows = [
    { label: "New", value: queue.new },
    { label: "Enriched", value: queue.enriched },
    { label: "Scored", value: queue.scored },
    { label: "Positioned", value: queue.positioned },
    { label: "Proposal ready", value: queue.proposalReady },
    { label: "Approved", value: queue.approved },
    { label: "Built", value: queue.built },
  ];

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-3">Queue summary</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {rows.map(({ label, value }) => (
          <div key={label} className="rounded border border-neutral-800 p-2">
            <div className="text-xs text-neutral-500">{label}</div>
            <div className="text-lg font-semibold text-neutral-100">{value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
