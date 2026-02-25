/**
 * Phase 3.3: Data freshness — "Last computed X min ago", stale warning if > 24h.
 */
type Props = {
  computedAt: string | null;
};

function minsAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
}

export function DataFreshnessIndicator({ computedAt }: Props) {
  if (!computedAt) return null;

  const mins = minsAgo(computedAt);
  const hours = Math.floor(mins / 60);
  const stale = mins > 24 * 60;

  let label: string;
  if (mins < 1) label = "Just now";
  else if (mins < 60) label = `${mins} min ago`;
  else if (hours < 24) label = `${hours}h ago`;
  else label = `${Math.floor(hours / 24)}d ago`;

  return (
    <div
      className="flex items-center gap-2 text-xs text-neutral-500"
      data-testid="data-freshness"
    >
      <span>Last computed {label}</span>
      {stale && (
        <span
          className="rounded px-1.5 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/40"
          title="Score data is older than 24h"
        >
          Stale
        </span>
      )}
    </div>
  );
}
