"use client";

import { useEffect, useState } from "react";
import { Save, RotateCcw } from "lucide-react";

const DEFAULTS = {
  mode: "manual",
  dryRun: true,
  targetCpl: null as number | null,
  minSpendForDecision: 20,
  minImpressionsForDecision: 100,
  maxBudgetIncreasePctPerAction: 10,
  maxBudgetIncreasePctPerDay: 20,
  allowChangesDuringLearning: false,
  protectedCampaignIds: [] as string[],
  actionCooldownMinutes: 720,
  maxActionsPerEntityPerDay: 2,
};

export function MetaAdsSettingsPanel() {
  const [settings, setSettings] = useState<typeof DEFAULTS & { id?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [protectedIdsInput, setProtectedIdsInput] = useState("");

  useEffect(() => {
    fetch("/api/meta-ads/settings")
      .then((res) => res.json())
      .then((json) => {
        const s = json.settings;
        if (s) {
          setSettings({
            mode: s.mode ?? DEFAULTS.mode,
            dryRun: s.dryRun ?? DEFAULTS.dryRun,
            targetCpl: s.targetCpl ?? DEFAULTS.targetCpl,
            minSpendForDecision: s.minSpendForDecision ?? DEFAULTS.minSpendForDecision,
            minImpressionsForDecision: s.minImpressionsForDecision ?? DEFAULTS.minImpressionsForDecision,
            maxBudgetIncreasePctPerAction: s.maxBudgetIncreasePctPerAction ?? DEFAULTS.maxBudgetIncreasePctPerAction,
            maxBudgetIncreasePctPerDay: s.maxBudgetIncreasePctPerDay ?? DEFAULTS.maxBudgetIncreasePctPerDay,
            allowChangesDuringLearning: s.allowChangesDuringLearning ?? DEFAULTS.allowChangesDuringLearning,
            protectedCampaignIds: (s.protectedCampaignIds as string[]) ?? DEFAULTS.protectedCampaignIds,
            actionCooldownMinutes: s.actionCooldownMinutes ?? DEFAULTS.actionCooldownMinutes,
            maxActionsPerEntityPerDay: s.maxActionsPerEntityPerDay ?? DEFAULTS.maxActionsPerEntityPerDay,
          });
          setProtectedIdsInput(((s.protectedCampaignIds as string[]) ?? []).join("\n"));
        } else {
          setSettings(DEFAULTS);
          setProtectedIdsInput("");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      const ids = protectedIdsInput
        .split(/[\s,\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/meta-ads/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: settings.mode,
          dryRun: settings.dryRun,
          targetCpl: settings.targetCpl,
          minSpendForDecision: settings.minSpendForDecision,
          minImpressionsForDecision: settings.minImpressionsForDecision,
          maxBudgetIncreasePctPerAction: settings.maxBudgetIncreasePctPerAction,
          maxBudgetIncreasePctPerDay: settings.maxBudgetIncreasePctPerDay,
          allowChangesDuringLearning: settings.allowChangesDuringLearning,
          protectedCampaignIds: [...new Set(ids)],
          actionCooldownMinutes: settings.actionCooldownMinutes,
          maxActionsPerEntityPerDay: settings.maxActionsPerEntityPerDay,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? "Save failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setSettings(DEFAULTS);
    setProtectedIdsInput("");
    setError(null);
  }

  if (loading || !settings) {
    return <div className="h-48 rounded-lg bg-neutral-800 animate-pulse" />;
  }

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-4">Automation Settings</h2>

      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

      <div className="space-y-4 max-w-md">
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Mode</label>
          <select
            value={settings.mode}
            onChange={(e) => setSettings({ ...settings, mode: e.target.value as string })}
            className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200"
          >
            <option value="manual">Manual</option>
            <option value="approve_required">Approve required</option>
            <option value="auto_safe">Auto safe</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="dryRun"
            checked={settings.dryRun}
            onChange={(e) => setSettings({ ...settings, dryRun: e.target.checked })}
            className="rounded border-neutral-600"
          />
          <label htmlFor="dryRun" className="text-sm text-neutral-300">Dry-run (simulate writes, no real changes)</label>
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Target CPL ($)</label>
          <input
            type="number"
            min={0}
            step={1}
            value={settings.targetCpl ?? ""}
            onChange={(e) => setSettings({ ...settings, targetCpl: e.target.value ? parseFloat(e.target.value) : null })}
            placeholder="Leave empty to use account avg"
            className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Min spend for decision ($)</label>
          <input
            type="number"
            min={0}
            value={settings.minSpendForDecision}
            onChange={(e) => setSettings({ ...settings, minSpendForDecision: parseFloat(e.target.value) || 0 })}
            className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Min impressions for decision</label>
          <input
            type="number"
            min={0}
            value={settings.minImpressionsForDecision}
            onChange={(e) => setSettings({ ...settings, minImpressionsForDecision: parseInt(e.target.value, 10) || 0 })}
            className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Max budget increase % per action</label>
          <input
            type="number"
            min={0}
            max={100}
            value={settings.maxBudgetIncreasePctPerAction}
            onChange={(e) => setSettings({ ...settings, maxBudgetIncreasePctPerAction: parseFloat(e.target.value) || 0 })}
            className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Max budget increase % per day</label>
          <input
            type="number"
            min={0}
            max={100}
            value={settings.maxBudgetIncreasePctPerDay}
            onChange={(e) => setSettings({ ...settings, maxBudgetIncreasePctPerDay: parseFloat(e.target.value) || 0 })}
            className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="allowChangesDuringLearning"
            checked={settings.allowChangesDuringLearning}
            onChange={(e) => setSettings({ ...settings, allowChangesDuringLearning: e.target.checked })}
            className="rounded border-neutral-600"
          />
          <label htmlFor="allowChangesDuringLearning" className="text-sm text-neutral-300">Allow changes during learning</label>
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Protected campaign IDs (one per line or comma-separated)</label>
          <textarea
            value={protectedIdsInput}
            onChange={(e) => setProtectedIdsInput(e.target.value)}
            placeholder="e.g. 123456&#10;789012"
            rows={3}
            className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Action cooldown (minutes, 0 = disabled)</label>
          <input
            type="number"
            min={0}
            max={10080}
            value={settings.actionCooldownMinutes}
            onChange={(e) => setSettings({ ...settings, actionCooldownMinutes: parseInt(e.target.value, 10) || 0 })}
            className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200"
          />
          <p className="text-[10px] text-neutral-500 mt-0.5">Default 720 (12h). Prevents re-applying to same entity too soon.</p>
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Max actions per entity per day</label>
          <input
            type="number"
            min={0}
            max={50}
            value={settings.maxActionsPerEntityPerDay}
            onChange={(e) => setSettings({ ...settings, maxActionsPerEntityPerDay: parseInt(e.target.value, 10) || 0 })}
            className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200"
          />
          <p className="text-[10px] text-neutral-500 mt-0.5">Default 2. 0 = disabled.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={reset}
            className="flex items-center gap-2 rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-700"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>
      </div>
    </section>
  );
}
