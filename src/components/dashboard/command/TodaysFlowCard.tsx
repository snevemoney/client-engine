import type { QueueSummary } from "@/lib/ops/queueSummary";

export function TodaysFlowCard({ queue }: { queue: QueueSummary }) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-2">Today&apos;s flow</h2>
      <div className="text-xs text-neutral-400 space-y-1">
        <p><strong>Inputs:</strong> New leads in queue: {queue.new}. Enriched: {queue.enriched}.</p>
        <p><strong>Process:</strong> Scored {queue.scored}, positioned {queue.positioned}, proposals ready {queue.proposalReady}.</p>
        <p><strong>Outputs:</strong> Approved {queue.approved}, built {queue.built}.</p>
      </div>
    </section>
  );
}
