"use client";

/**
 * Phase 3.4: Score alerts preferences panel — enable/disable per event type.
 */
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import type { ScoreAlertsPreferences } from "@/lib/scores/alerts-preferences";

type Props = {
  compact?: boolean;
};

export function AlertsPreferencesPanel({ compact = false }: Props) {
  const [prefs, setPrefs] = useState<ScoreAlertsPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<ScoreAlertsPreferences>>({});

  const fetchPrefs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/internal/scores/alerts/preferences", {
        credentials: "include",
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        setPrefs(json);
        setDraft({});
      } else {
        const err = await res.json();
        setError(err?.error ?? "Failed to load");
        setPrefs(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setPrefs(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPrefs();
  }, [fetchPrefs]);

  const current = { ...prefs, ...draft } as ScoreAlertsPreferences | null;

  const handleSave = async () => {
    if (!Object.keys(draft).length) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/internal/scores/alerts/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(draft),
      });
      if (res.ok) {
        const json = await res.json();
        setPrefs(json);
        setDraft({});
        setSuccess("Preferences saved");
        setTimeout(() => setSuccess(null), 4000);
      } else {
        const err = await res.json();
        setError(err?.error ?? "Save failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setDraft({
      enabled: true,
      events: { threshold_breach: true, sharp_drop: true, recovery: true },
      sharpDropMinDelta: 15,
      cooldownMinutes: 60,
    });
  };

  if (loading) {
    return <p className="text-sm text-neutral-500">Loading preferences…</p>;
  }

  if (!prefs && !current) {
    return (
      <div className="text-sm text-neutral-500" data-testid="alerts-prefs-error">
        {error ?? "Unable to load preferences"}
      </div>
    );
  }

  const p = current!;
  const hasChanges = Object.keys(draft).length > 0;

  const toggle = (key: keyof typeof p.events, val: boolean) => {
    setDraft((d) => ({
      ...d,
      events: { ...p.events, ...(d.events ?? {}), [key]: val },
    }));
  };

  const setEnabled = (val: boolean) => setDraft((d) => ({ ...d, enabled: val }));
  const setSharpDropMinDelta = (val: number) =>
    setDraft((d) => ({ ...d, sharpDropMinDelta: Math.max(1, Math.min(100, val)) }));
  const setCooldownMinutes = (val: number) =>
    setDraft((d) => ({ ...d, cooldownMinutes: Math.max(0, Math.min(1440, val)) }));

  if (compact) {
    const enabledCount = [p.events.threshold_breach, p.events.sharp_drop, p.events.recovery].filter(
      Boolean
    ).length;
    return (
      <div className="text-xs text-neutral-500" data-testid="alerts-prefs-summary">
        Alerts: {p.enabled ? `On (${enabledCount}/3 event types)` : "Off"}
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 space-y-4"
      data-testid="alerts-preferences-panel"
    >
      <div>
        <h2 className="text-sm font-medium text-neutral-300 mb-1">Score alert preferences</h2>
        <p className="text-xs text-neutral-500">Control which score events generate notifications.</p>
      </div>

      {error && (
        <div
          className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400"
          role="alert"
          data-testid="alerts-prefs-error"
        >
          {error}
        </div>
      )}
      {success && (
        <div
          className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400"
          role="status"
        >
          {success}
        </div>
      )}

      <div className="space-y-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={p.enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            data-testid="alerts-enabled-toggle"
          />
          <span className="text-sm">Enable score alerts</span>
        </label>

        <div className="pl-6 space-y-2 border-l border-neutral-700">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={p.events.threshold_breach}
              onChange={(e) => toggle("threshold_breach", e.target.checked)}
              disabled={!p.enabled}
              data-testid="alerts-events-threshold_breach"
            />
            <span className="text-sm">Threshold breach</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={p.events.sharp_drop}
              onChange={(e) => toggle("sharp_drop", e.target.checked)}
              disabled={!p.enabled}
              data-testid="alerts-events-sharp_drop"
            />
            <span className="text-sm">Sharp drop</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={p.events.recovery}
              onChange={(e) => toggle("recovery", e.target.checked)}
              disabled={!p.enabled}
              data-testid="alerts-events-recovery"
            />
            <span className="text-sm">Recovery</span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div>
            <label className="text-xs text-neutral-500 block mb-1">Sharp drop min Δ</label>
            <input
              type="number"
              min={1}
              max={100}
              value={p.sharpDropMinDelta}
              onChange={(e) => setSharpDropMinDelta(Number(e.target.value) || 15)}
              className="w-20 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
              data-testid="alerts-sharp-drop-min-delta"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-500 block mb-1">
              Notification cooldown (min)
            </label>
            <input
              type="number"
              min={0}
              max={1440}
              value={p.cooldownMinutes}
              onChange={(e) => setCooldownMinutes(Number(e.target.value) || 0)}
              className="w-20 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
              data-testid="alerts-cooldown-minutes"
            />
            <p className="text-xs text-neutral-600 mt-0.5">
              {p.cooldownMinutes === 0
                ? "No cooldown — repeat alerts allowed immediately"
                : `Suppress repeat alerts of the same type for this entity for ${p.cooldownMinutes} min`}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center pt-2">
        <Button
          size="sm"
          onClick={() => void handleSave()}
          disabled={saving || !hasChanges}
          data-testid="alerts-prefs-save"
        >
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          data-testid="alerts-prefs-reset"
        >
          Reset to defaults
        </Button>
        {p.updatedAt && (
          <span className="text-xs text-neutral-500 ml-2">
            Updated {new Date(p.updatedAt).toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}
