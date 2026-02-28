"use client";

import { useEffect, useState, useCallback } from "react";
import { Save, RotateCcw, Play } from "lucide-react";
import { MetaAdsSchedulerRunsPanel } from "./MetaAdsSchedulerRunsPanel";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

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
  schedulerEnabled: false,
  schedulerIntervalMinutes: 60,
  autoGenerateRecommendations: true,
  autoApplyApprovedOnly: true,
  autoApproveLowRisk: false,
  maxAppliesPerRun: 5,
  allowedAutoApproveRuleKeys: [] as string[],
  alertsEnabled: false,
  alertOnSchedulerFailure: true,
  alertOnCriticalRecommendations: true,
  alertOnBlockedActions: false,
  alertCooldownMinutes: 60,
  alertMinSeverity: "critical" as "warn" | "critical",
  lastSchedulerRunAt: null as string | null,
  lastSchedulerRunStatus: null as string | null,
  lastSchedulerRunSummary: null as Record<string, unknown> | null,
};

export default function MetaAdsSettingsPanel() {
  const [settings, setSettings] = useState<typeof DEFAULTS & { id?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runLoading, setRunLoading] = useState(false);
  const [runsRefreshKey, setRunsRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { confirm: confirmRun, dialogProps: runDialogProps } = useConfirmDialog();
  const [protectedIdsInput, setProtectedIdsInput] = useState("");
  const [autoApproveRuleKeysInput, setAutoApproveRuleKeysInput] = useState("");

  const fetchSettings = useCallback(() => {
    fetch("/api/meta-ads/settings")
      .then((res) => res.json())
      .then((json) => {
        const s = json.settings;
        if (s) {
          setSettings({
            ...DEFAULTS,
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
            schedulerEnabled: s.schedulerEnabled ?? DEFAULTS.schedulerEnabled,
            schedulerIntervalMinutes: s.schedulerIntervalMinutes ?? DEFAULTS.schedulerIntervalMinutes,
            autoGenerateRecommendations: s.autoGenerateRecommendations ?? DEFAULTS.autoGenerateRecommendations,
            autoApplyApprovedOnly: s.autoApplyApprovedOnly ?? DEFAULTS.autoApplyApprovedOnly,
            autoApproveLowRisk: s.autoApproveLowRisk ?? DEFAULTS.autoApproveLowRisk,
            maxAppliesPerRun: s.maxAppliesPerRun ?? DEFAULTS.maxAppliesPerRun,
            allowedAutoApproveRuleKeys: (s.allowedAutoApproveRuleKeys as string[]) ?? DEFAULTS.allowedAutoApproveRuleKeys,
            alertsEnabled: s.alertsEnabled ?? DEFAULTS.alertsEnabled,
            alertOnSchedulerFailure: s.alertOnSchedulerFailure ?? DEFAULTS.alertOnSchedulerFailure,
            alertOnCriticalRecommendations: s.alertOnCriticalRecommendations ?? DEFAULTS.alertOnCriticalRecommendations,
            alertOnBlockedActions: s.alertOnBlockedActions ?? DEFAULTS.alertOnBlockedActions,
            alertCooldownMinutes: s.alertCooldownMinutes ?? DEFAULTS.alertCooldownMinutes,
            alertMinSeverity: (s.alertMinSeverity ?? DEFAULTS.alertMinSeverity) as "warn" | "critical",
            lastSchedulerRunAt: s.lastSchedulerRunAt ?? null,
            lastSchedulerRunStatus: s.lastSchedulerRunStatus ?? null,
            lastSchedulerRunSummary: (s.lastSchedulerRunSummary as Record<string, unknown>) ?? null,
          });
          setProtectedIdsInput(((s.protectedCampaignIds as string[]) ?? []).join("\n"));
          setAutoApproveRuleKeysInput(((s.allowedAutoApproveRuleKeys as string[]) ?? []).join(", "));
        } else {
          setSettings(DEFAULTS);
          setProtectedIdsInput("");
          setAutoApproveRuleKeysInput("");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function save() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      const ids = protectedIdsInput
        .split(/[\s,\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const ruleKeys = autoApproveRuleKeysInput.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
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
          schedulerEnabled: settings.schedulerEnabled,
          schedulerIntervalMinutes: settings.schedulerIntervalMinutes,
          autoGenerateRecommendations: settings.autoGenerateRecommendations,
          autoApplyApprovedOnly: settings.autoApplyApprovedOnly,
          autoApproveLowRisk: settings.autoApproveLowRisk,
          maxAppliesPerRun: settings.maxAppliesPerRun,
          allowedAutoApproveRuleKeys: [...new Set(ruleKeys)],
          alertsEnabled: settings.alertsEnabled,
          alertOnSchedulerFailure: settings.alertOnSchedulerFailure,
          alertOnCriticalRecommendations: settings.alertOnCriticalRecommendations,
          alertOnBlockedActions: settings.alertOnBlockedActions,
          alertCooldownMinutes: settings.alertCooldownMinutes,
          alertMinSeverity: settings.alertMinSeverity,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error ?? "Save failed");
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
    setAutoApproveRuleKeysInput("");
    setError(null);
  }

  async function runSchedulerNow() {
    setRunLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/meta-ads/scheduler/run", { method: "POST" });
      const json = await res.json();
      if (json.ok !== false && json.status !== "skipped") {
        fetchSettings();
        setRunsRefreshKey((k) => k + 1);
      } else if (json.status === "skipped") {
        setError("Scheduler disabled. Enable it first.");
      } else {
        setError(json.summary?.error ?? "Run failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setRunLoading(false);
    }
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
            onChange={(e) => setSettings({ ...settings, targetCpl: e.target.value ? Math.max(0, parseFloat(e.target.value)) : null })}
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
            onChange={(e) => setSettings({ ...settings, minSpendForDecision: Math.max(0, parseFloat(e.target.value) || 0) })}
            className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Min impressions for decision</label>
          <input
            type="number"
            min={0}
            value={settings.minImpressionsForDecision}
            onChange={(e) => setSettings({ ...settings, minImpressionsForDecision: Math.max(0, parseInt(e.target.value, 10) || 0) })}
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
            onChange={(e) => setSettings({ ...settings, maxBudgetIncreasePctPerAction: Math.max(0, parseFloat(e.target.value) || 0) })}
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
            onChange={(e) => setSettings({ ...settings, maxBudgetIncreasePctPerDay: Math.max(0, parseFloat(e.target.value) || 0) })}
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
            onChange={(e) => setSettings({ ...settings, actionCooldownMinutes: Math.max(0, parseInt(e.target.value, 10) || 0) })}
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
            onChange={(e) => setSettings({ ...settings, maxActionsPerEntityPerDay: Math.max(0, parseInt(e.target.value, 10) || 0) })}
            className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200"
          />
          <p className="text-[10px] text-neutral-500 mt-0.5">Default 2. 0 = disabled.</p>
        </div>

        <hr className="border-neutral-700 my-4" />
        <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Scheduler (V3.2)</h3>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="schedulerEnabled"
            checked={settings.schedulerEnabled}
            onChange={(e) => setSettings({ ...settings, schedulerEnabled: e.target.checked })}
            className="rounded border-neutral-600"
          />
          <label htmlFor="schedulerEnabled" className="text-sm text-neutral-300">Scheduler enabled</label>
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Interval (minutes)</label>
          <input
            type="number"
            min={5}
            max={1440}
            value={settings.schedulerIntervalMinutes}
            onChange={(e) => setSettings({ ...settings, schedulerIntervalMinutes: Math.min(1440, Math.max(5, parseInt(e.target.value, 10) || 60)) })}
            className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="autoGenerateRecommendations"
            checked={settings.autoGenerateRecommendations}
            onChange={(e) => setSettings({ ...settings, autoGenerateRecommendations: e.target.checked })}
            className="rounded border-neutral-600"
          />
          <label htmlFor="autoGenerateRecommendations" className="text-sm text-neutral-300">Auto-generate recommendations</label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="autoApplyApprovedOnly"
            checked={settings.autoApplyApprovedOnly}
            onChange={(e) => setSettings({ ...settings, autoApplyApprovedOnly: e.target.checked })}
            className="rounded border-neutral-600"
          />
          <label htmlFor="autoApplyApprovedOnly" className="text-sm text-neutral-300">Auto-apply approved only</label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="autoApproveLowRisk"
            checked={settings.autoApproveLowRisk}
            onChange={(e) => setSettings({ ...settings, autoApproveLowRisk: e.target.checked })}
            className="rounded border-neutral-600"
          />
          <label htmlFor="autoApproveLowRisk" className="text-sm text-neutral-300">Auto-approve low-risk (rule keys below)</label>
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Allowed auto-approve rule keys (comma-separated)</label>
          <input
            type="text"
            value={autoApproveRuleKeysInput}
            onChange={(e) => setAutoApproveRuleKeysInput(e.target.value)}
            placeholder="e.g. winner_scale_candidate, insufficient_data"
            className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Max applies per run</label>
          <input
            type="number"
            min={1}
            max={50}
            value={settings.maxAppliesPerRun}
            onChange={(e) => setSettings({ ...settings, maxAppliesPerRun: Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 5)) })}
            className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200"
          />
        </div>

        <hr className="border-neutral-700 my-4" />
        <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Alerts (V3.3)</h3>
        <p className="text-[10px] text-neutral-500 mb-2">Via NOTIFY_WEBHOOK_URL or DISCORD_WEBHOOK_URL.</p>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="alertsEnabled"
            checked={settings.alertsEnabled}
            onChange={(e) => setSettings({ ...settings, alertsEnabled: e.target.checked })}
            className="rounded border-neutral-600"
          />
          <label htmlFor="alertsEnabled" className="text-sm text-neutral-300">Alerts enabled</label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="alertOnSchedulerFailure"
            checked={settings.alertOnSchedulerFailure}
            onChange={(e) => setSettings({ ...settings, alertOnSchedulerFailure: e.target.checked })}
            className="rounded border-neutral-600"
          />
          <label htmlFor="alertOnSchedulerFailure" className="text-sm text-neutral-300">Alert on scheduler failure</label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="alertOnCriticalRecommendations"
            checked={settings.alertOnCriticalRecommendations}
            onChange={(e) => setSettings({ ...settings, alertOnCriticalRecommendations: e.target.checked })}
            className="rounded border-neutral-600"
          />
          <label htmlFor="alertOnCriticalRecommendations" className="text-sm text-neutral-300">Alert on critical recommendations</label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="alertOnBlockedActions"
            checked={settings.alertOnBlockedActions}
            onChange={(e) => setSettings({ ...settings, alertOnBlockedActions: e.target.checked })}
            className="rounded border-neutral-600"
          />
          <label htmlFor="alertOnBlockedActions" className="text-sm text-neutral-300">Alert on blocked actions</label>
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Alert cooldown (min)</label>
          <input
            type="number"
            min={1}
            max={1440}
            value={settings.alertCooldownMinutes}
            onChange={(e) => setSettings({ ...settings, alertCooldownMinutes: Math.min(1440, Math.max(1, parseInt(e.target.value, 10) || 60)) })}
            className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Min severity</label>
          <select
            value={settings.alertMinSeverity}
            onChange={(e) => setSettings({ ...settings, alertMinSeverity: e.target.value as "warn" | "critical" })}
            className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200"
          >
            <option value="warn">Warn</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <hr className="border-neutral-700 my-4" />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              const ok = await confirmRun({
                title: "Run scheduler now",
                body: "This will run the Meta Ads scheduler immediately. Continue?",
                confirmLabel: "Run now",
              });
              if (ok) void runSchedulerNow();
            }}
            disabled={runLoading}
            className="flex items-center gap-2 rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-700 disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            {runLoading ? "Running…" : "Run now"}
          </button>
          {settings.lastSchedulerRunAt && (
            <span className="text-xs text-neutral-500">
              Last: {new Date(settings.lastSchedulerRunAt).toLocaleString("en-US")} — {settings.lastSchedulerRunStatus ?? "—"}
            </span>
          )}
        </div>
        {settings.lastSchedulerRunSummary && typeof settings.lastSchedulerRunSummary === "object" && (
          <div className="text-[10px] text-neutral-500">
            {[
              settings.lastSchedulerRunSummary.generated != null && `gen: ${settings.lastSchedulerRunSummary.generated}`,
              settings.lastSchedulerRunSummary.applied != null && `applied: ${settings.lastSchedulerRunSummary.applied}`,
              settings.lastSchedulerRunSummary.simulated != null && `sim: ${settings.lastSchedulerRunSummary.simulated}`,
              settings.lastSchedulerRunSummary.blocked != null && `blocked: ${settings.lastSchedulerRunSummary.blocked}`,
              settings.lastSchedulerRunSummary.failed != null && `failed: ${settings.lastSchedulerRunSummary.failed}`,
              (typeof settings.lastSchedulerRunSummary.alertsSent === "number" && settings.lastSchedulerRunSummary.alertsSent > 0) && `alerts: ${settings.lastSchedulerRunSummary.alertsSent}`,
              settings.lastSchedulerRunSummary.trendDataAvailable === true && "trends ✓",
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        )}

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
      <MetaAdsSchedulerRunsPanel className="mt-6" refreshKey={runsRefreshKey} />
      <ConfirmDialog {...runDialogProps} />
    </section>
  );
}
