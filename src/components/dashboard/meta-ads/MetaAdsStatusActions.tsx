"use client";

import { useState } from "react";
import { Pause, Play } from "lucide-react";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { MetaStatusLevel } from "@/lib/meta-ads/client";

type Props = {
  level: MetaStatusLevel;
  id: string;
  name: string;
  effectiveStatus: string;
  onSuccess: () => void;
};

export function MetaAdsStatusActions({ level, id, name, effectiveStatus, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialogProps } = useConfirmDialog();

  const isActive = effectiveStatus === "ACTIVE";
  const isPaused = effectiveStatus === "PAUSED";

  async function executeAction(action: "pause" | "resume") {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/meta-ads/actions/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, id, action }),
      });
      const json = await res.json();

      if (!json.ok) {
        setError(json.error ?? "Action failed");
        return;
      }
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action: "pause" | "resume") {
    const label = action === "pause" ? "Pause" : "Resume";
    const ok = await confirm({
      title: `${label} ${level}`,
      body: `${label} "${name}"?`,
      confirmLabel: label,
      variant: action === "pause" ? "destructive" : "default",
    });
    if (ok) void executeAction(action);
  }

  if (!isActive && !isPaused) return null;

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        {isActive && (
          <button
            type="button"
            onClick={() => handleAction("pause")}
            disabled={loading}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-amber-200 hover:bg-amber-900/40 disabled:opacity-50 disabled:cursor-not-allowed"
            title={`Pause ${name}`}
          >
            <Pause className="w-3 h-3" />
            {loading ? "…" : "Pause"}
          </button>
        )}
        {isPaused && (
          <button
            type="button"
            onClick={() => handleAction("resume")}
            disabled={loading}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-emerald-200 hover:bg-emerald-900/40 disabled:opacity-50 disabled:cursor-not-allowed"
            title={`Resume ${name}`}
          >
            <Play className="w-3 h-3" />
            {loading ? "…" : "Resume"}
          </button>
        )}
      </div>
      {error && <span className="text-[10px] text-red-400">{error}</span>}
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
