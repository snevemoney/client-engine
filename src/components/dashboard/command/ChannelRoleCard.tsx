"use client";

import type { ChannelRoleCritique } from "@/lib/ops/channelRoleMap";
import { AlertTriangle, CheckCircle } from "lucide-react";

export function ChannelRoleCard({ data }: { data: ChannelRoleCritique | null }) {
  if (!data) {
    return (
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-2">Channel role (strategy)</h2>
        <p className="text-xs text-neutral-500">Loading…</p>
      </section>
    );
  }

  const { warnings, summary } = data;

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-2">Channel role (weekly critique)</h2>
      <p className="text-xs text-neutral-500 mb-3">
        Strategy balance: reach vs authority vs owned-audience capture. See docs/CHANNEL_ROLE_MAP.md.
      </p>
      {warnings.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-emerald-400">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{summary}</span>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-amber-400 font-medium">{summary}</p>
          <ul className="space-y-1.5">
            {warnings.map((w) => (
              <li key={w.code} className="flex gap-2 text-xs">
                <AlertTriangle className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${w.severity === "warning" ? "text-amber-400" : "text-neutral-500"}`} />
                <span className="text-neutral-300">{w.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
