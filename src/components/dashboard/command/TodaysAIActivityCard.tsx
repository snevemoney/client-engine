import Link from "next/link";

export function TodaysAIActivityCard({
  lastRunContent,
  lastRunAt,
}: {
  lastRunContent: string | null;
  lastRunAt: string | null;
}) {
  if (!lastRunAt && !lastRunContent) {
    return (
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-2">Today&apos;s AI Activity</h2>
        <p className="text-xs text-neutral-500">No workday run yet. Click Start Workday Automation.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-2">Today&apos;s AI Activity</h2>
      {lastRunAt && (
        <p className="text-xs text-neutral-500 mb-2">
          Last run: {new Date(lastRunAt).toLocaleString()}
          <span className="text-neutral-600 ml-1">· auto-refreshes after workday run</span>
        </p>
      )}
      {lastRunContent ? (
        <pre className="text-xs text-neutral-400 whitespace-pre-wrap font-sans max-h-40 overflow-y-auto">
          {lastRunContent.slice(0, 800)}
          {lastRunContent.length > 800 ? "\n…" : ""}
        </pre>
      ) : (
        <p className="text-xs text-neutral-500">Run report not available.</p>
      )}
      <Link href="/dashboard/metrics" className="text-xs text-neutral-400 hover:text-white mt-2 inline-block">
        Full metrics →
      </Link>
    </section>
  );
}
