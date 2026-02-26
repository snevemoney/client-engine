"use client";

import { CheckCircle2, XCircle, Clock, Database } from "lucide-react";

type StatusStripProps = {
  status: "connected" | "error" | "loading";
  accountId: string | null;
  range: string;
  cacheState: "cached" | "fresh" | "loading";
  lastSyncedAt: string | null;
};

export function MetaAdsDataStatusStrip({
  status,
  accountId,
  range,
  cacheState,
  lastSyncedAt,
}: StatusStripProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-xs">
      <span className="flex items-center gap-1.5 text-neutral-400">
        {status === "connected" ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        ) : status === "error" ? (
          <XCircle className="w-3.5 h-3.5 text-red-400" />
        ) : (
          <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
        )}
        {status === "connected" ? "Connected" : status === "error" ? "Error" : "Loading…"}
      </span>
      {accountId && (
        <span className="text-neutral-500 font-mono">{accountId}</span>
      )}
      <span className="text-neutral-500">Range: {range}</span>
      <span className="flex items-center gap-1.5 text-neutral-500">
        <Database className="w-3.5 h-3.5" />
        {cacheState === "cached" && "Cached"}
        {cacheState === "fresh" && "Fresh"}
        {cacheState === "loading" && "—"}
      </span>
      {lastSyncedAt && (
        <span className="text-neutral-500">
          Synced: {new Date(lastSyncedAt).toLocaleString("en-US")}
        </span>
      )}
    </div>
  );
}
