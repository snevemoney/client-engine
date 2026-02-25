"use client";

/**
 * Phase 3.4: Compact chip showing score alerts status.
 */
import Link from "next/link";
import { useState, useEffect } from "react";
import { Bell } from "lucide-react";

export function AlertsSummaryChip() {
  const [prefs, setPrefs] = useState<{
    enabled: boolean;
    events: { threshold_breach: boolean; sharp_drop: boolean; recovery: boolean };
    cooldownMinutes: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/internal/scores/alerts/preferences", {
      credentials: "include",
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(setPrefs)
      .catch(() => setPrefs(null));
  }, []);

  if (!prefs) return null;

  const enabledCount = [
    prefs.events.threshold_breach,
    prefs.events.sharp_drop,
    prefs.events.recovery,
  ].filter(Boolean).length;

  const cooldownLabel = prefs.cooldownMinutes === 0 ? "no cooldown" : `${prefs.cooldownMinutes}m`;
  return (
    <Link
      href="/dashboard/internal/scores/alerts"
      className="inline-flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-900/50 px-2.5 py-1 text-xs text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-colors"
      data-testid="alerts-summary-chip"
      title={prefs.enabled ? `Alerts on (${enabledCount}/3), cooldown ${cooldownLabel}` : "Alerts off"}
    >
      <Bell className="w-3.5 h-3.5" />
      <span>
        Alerts: {prefs.enabled ? `On (${enabledCount}/3, ${cooldownLabel})` : "Off"}
      </span>
    </Link>
  );
}
