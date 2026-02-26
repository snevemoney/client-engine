"use client";

import { useState, useEffect } from "react";

type Props = {
  computedAt: string | null;
};

function minsAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
}

function formatLabel(mins: number): string {
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function DataFreshnessIndicator({ computedAt }: Props) {
  const [label, setLabel] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (!computedAt) return;
    function update() {
      const mins = minsAgo(computedAt!);
      setLabel(formatLabel(mins));
      setStale(mins > 24 * 60);
    }
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [computedAt]);

  if (!computedAt || label === null) return null;

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
