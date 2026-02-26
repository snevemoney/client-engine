"use client";

import { Wifi, WifiOff, AlertTriangle } from "lucide-react";

type ConnectionInfo = {
  provider: string;
  isEnabled: boolean;
  mode: string;
  status: string;
  hasCredentials: boolean;
};

export function ConnectionStatusBadge({ connection }: { connection: ConnectionInfo | null }) {
  if (!connection) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-neutral-800/60 text-neutral-500">
        <WifiOff className="h-3 w-3" />
        Not connected
      </span>
    );
  }

  if (!connection.isEnabled || connection.mode === "off") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-neutral-800/60 text-neutral-500">
        <WifiOff className="h-3 w-3" />
        Off
      </span>
    );
  }

  if (connection.status === "error") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-red-950/40 text-red-400">
        <AlertTriangle className="h-3 w-3" />
        Error
      </span>
    );
  }

  const modeLabel = connection.mode === "live" ? "Live" : connection.mode === "mock" ? "Test" : "Manual";
  const color = connection.mode === "live"
    ? "bg-green-950/40 text-green-400"
    : connection.mode === "mock"
    ? "bg-amber-950/40 text-amber-400"
    : "bg-blue-950/40 text-blue-400";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${color}`}>
      <Wifi className="h-3 w-3" />
      {modeLabel}
    </span>
  );
}
