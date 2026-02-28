"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Sparkles } from "lucide-react";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AsyncState } from "@/components/ui/AsyncState";
import { fetchJsonThrow } from "@/lib/http/fetch-json";

type Priority = { id: string; title: string; status: string };

type StrategyWeek = {
  id: string;
  weekStart: string;
  phase: string | null;
  activeCampaignName: string | null;
  activeCampaignAudience: string | null;
  activeCampaignChannel: string | null;
  activeCampaignOffer: string | null;
  activeCampaignCta: string | null;
  activeCampaignProof: string | null;
  operatorImprovementFocus: string | null;
  salesTarget: string | null;
  notes: string | null;
  theme?: string | null;
  monthlyFocus?: string | null;
  weeklyTargetValue?: number | null;
  weeklyTargetUnit?: string | null;
  declaredCommitment?: string | null;
  keyMetric?: string | null;
  keyMetricTarget?: string | null;
  biggestBottleneck?: string | null;
  missionStatement?: string | null;
  whyThisWeekMatters?: string | null;
  dreamStatement?: string | null;
  fuelStatement?: string | null;
  priorities?: Priority[];
  review?: {
    campaignShipped: boolean;
    systemImproved: boolean;
    salesActionsDone: boolean;
    proofCaptured: boolean;
    biggestBottleneck: string | null;
    nextAutomation: string | null;
  };
};

const PHASES = ["survival", "formulation", "explosion", "plateau"] as const;

export default function StrategyQuadrantPanel() {
  const [data, setData] = useState<StrategyWeek | null>(null);
  const [history, setHistory] = useState<
    { weekStart: string; phase: string | null; activeCampaignName: string | null; reviewChecks: number; reviewTotal: number; biggestBottleneck: string | null }[]
  >([]);
  const [loading, setLoading] = useState(true);

  const [phase, setPhase] = useState("");
  const [activeCampaignName, setActiveCampaignName] = useState("");
  const [activeCampaignAudience, setActiveCampaignAudience] = useState("");
  const [activeCampaignChannel, setActiveCampaignChannel] = useState("");
  const [activeCampaignOffer, setActiveCampaignOffer] = useState("");
  const [activeCampaignCta, setActiveCampaignCta] = useState("");
  const [activeCampaignProof, setActiveCampaignProof] = useState("");
  const [operatorImprovementFocus, setOperatorImprovementFocus] = useState("");
  const [salesTarget, setSalesTarget] = useState("");
  const [notes, setNotes] = useState("");

  const [campaignShipped, setCampaignShipped] = useState(false);
  const [systemImproved, setSystemImproved] = useState(false);
  const [salesActionsDone, setSalesActionsDone] = useState(false);
  const [proofCaptured, setProofCaptured] = useState(false);
  const [biggestBottleneck, setBiggestBottleneck] = useState("");
  const [nextAutomation, setNextAutomation] = useState("");

  const [theme, setTheme] = useState("");
  const [monthlyFocus, setMonthlyFocus] = useState("");
  const [weeklyTargetValue, setWeeklyTargetValue] = useState("");
  const [weeklyTargetUnit, setWeeklyTargetUnit] = useState("");
  const [declaredCommitment, setDeclaredCommitment] = useState("");
  const [newPriorityTitle, setNewPriorityTitle] = useState("");
  const [keyMetric, setKeyMetric] = useState("");
  const [keyMetricTarget, setKeyMetricTarget] = useState("");
  const [anticipatedBottleneck, setAnticipatedBottleneck] = useState("");
  const [missionStatement, setMissionStatement] = useState("");
  const [whyThisWeekMatters, setWhyThisWeekMatters] = useState("");
  const [dreamStatement, setDreamStatement] = useState("");
  const [fuelStatement, setFuelStatement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const toastFn = (m: string, t?: "success" | "error") => t === "error" ? toast.error(m) : toast.success(m);
  const { confirm, dialogProps } = useConfirmDialog();

  const populateFromWeek = useCallback((week: StrategyWeek) => {
    setPhase(week.phase ?? "");
    setActiveCampaignName(week.activeCampaignName ?? "");
    setActiveCampaignAudience(week.activeCampaignAudience ?? "");
    setActiveCampaignChannel(week.activeCampaignChannel ?? "");
    setActiveCampaignOffer(week.activeCampaignOffer ?? "");
    setActiveCampaignCta(week.activeCampaignCta ?? "");
    setActiveCampaignProof(week.activeCampaignProof ?? "");
    setOperatorImprovementFocus(week.operatorImprovementFocus ?? "");
    setSalesTarget(week.salesTarget ?? "");
    setNotes(week.notes ?? "");
    setCampaignShipped(week.review?.campaignShipped ?? false);
    setSystemImproved(week.review?.systemImproved ?? false);
    setSalesActionsDone(week.review?.salesActionsDone ?? false);
    setProofCaptured(week.review?.proofCaptured ?? false);
    setBiggestBottleneck(week.review?.biggestBottleneck ?? "");
    setNextAutomation(week.review?.nextAutomation ?? "");
    setTheme(week.theme ?? "");
    setMonthlyFocus(week.monthlyFocus ?? "");
    setWeeklyTargetValue(week.weeklyTargetValue != null ? String(week.weeklyTargetValue) : "");
    setWeeklyTargetUnit(week.weeklyTargetUnit ?? "");
    setDeclaredCommitment(week.declaredCommitment ?? "");
    setKeyMetric(week.keyMetric ?? "");
    setKeyMetricTarget(week.keyMetricTarget ?? "");
    setAnticipatedBottleneck(week.biggestBottleneck ?? "");
    setMissionStatement(week.missionStatement ?? "");
    setWhyThisWeekMatters(week.whyThisWeekMatters ?? "");
    setDreamStatement(week.dreamStatement ?? "");
    setFuelStatement(week.fuelStatement ?? "");
  }, []);

  const fetchInitial = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const [weekRes, historyRes] = await Promise.all([
        fetch("/api/ops/strategy-week", { credentials: "include", signal: controller.signal, cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
        fetch("/api/ops/strategy-week/history?weeks=8", { credentials: "include", signal: controller.signal, cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      ]);
      if (controller.signal.aborted) return;
      const week = weekRes?.id ? weekRes : null;
      setData(week);
      if (week) populateFromWeek(week);
      setHistory(historyRes?.items ?? []);
    } catch (e) {
      if (controller.signal.aborted) return;
      if (e instanceof Error && (e.name === "AbortError" || e.message?.includes("aborted"))) return;
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }, [populateFromWeek]);

  useEffect(() => {
    void fetchInitial();
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [fetchInitial]);

  const { execute: handleSave, pending: saving } = useAsyncAction(
    async () =>
      fetchJsonThrow<StrategyWeek>("/api/ops/strategy-week", {
        method: "POST",
        body: JSON.stringify({
          phase: phase || undefined,
          activeCampaignName: activeCampaignName || undefined,
          activeCampaignAudience: activeCampaignAudience || undefined,
          activeCampaignChannel: activeCampaignChannel || undefined,
          activeCampaignOffer: activeCampaignOffer || undefined,
          activeCampaignCta: activeCampaignCta || undefined,
          activeCampaignProof: activeCampaignProof || undefined,
          operatorImprovementFocus: operatorImprovementFocus || undefined,
          salesTarget: salesTarget || undefined,
          notes: notes || undefined,
          theme: theme || undefined,
          monthlyFocus: monthlyFocus || undefined,
          weeklyTargetValue: weeklyTargetValue ? parseFloat(weeklyTargetValue) : undefined,
          weeklyTargetUnit: weeklyTargetUnit || undefined,
          declaredCommitment: declaredCommitment || undefined,
          keyMetric: keyMetric || undefined,
          keyMetricTarget: keyMetricTarget || undefined,
          biggestBottleneck: anticipatedBottleneck || undefined,
          missionStatement: missionStatement || undefined,
          whyThisWeekMatters: whyThisWeekMatters || undefined,
          dreamStatement: dreamStatement || undefined,
          fuelStatement: fuelStatement || undefined,
        }),
      }),
    { toast: toastFn, successMessage: "Strategy saved", onSuccess: (updated) => setData(updated) },
  );

  const { execute: handleAiFill, pending: aiFilling } = useAsyncAction(
    async () => {
      const d = await fetchJsonThrow<Record<string, unknown>>("/api/ops/strategy-week/ai-fill", { method: "POST" });
      if (d.phase) setPhase(d.phase as string);
      if (d.activeCampaignName) setActiveCampaignName(d.activeCampaignName as string);
      if (d.activeCampaignAudience) setActiveCampaignAudience((d.activeCampaignAudience as string) ?? "");
      if (d.activeCampaignChannel) setActiveCampaignChannel((d.activeCampaignChannel as string) ?? "");
      if (d.activeCampaignOffer) setActiveCampaignOffer((d.activeCampaignOffer as string) ?? "");
      if (d.activeCampaignCta) setActiveCampaignCta((d.activeCampaignCta as string) ?? "");
      if (d.activeCampaignProof) setActiveCampaignProof((d.activeCampaignProof as string) ?? "");
      if (d.operatorImprovementFocus) setOperatorImprovementFocus(d.operatorImprovementFocus as string);
      if (d.salesTarget) setSalesTarget(d.salesTarget as string);
      if (d.theme) setTheme(d.theme as string);
      if (d.monthlyFocus) setMonthlyFocus((d.monthlyFocus as string) ?? "");
      if (d.weeklyTargetValue != null) setWeeklyTargetValue(String(d.weeklyTargetValue));
      if (d.weeklyTargetUnit) setWeeklyTargetUnit(d.weeklyTargetUnit as string);
      if (d.declaredCommitment) setDeclaredCommitment(d.declaredCommitment as string);
      if (d.keyMetric) setKeyMetric(d.keyMetric as string);
      if (d.keyMetricTarget) setKeyMetricTarget((d.keyMetricTarget as string) ?? "");
      if (d.biggestBottleneck) setAnticipatedBottleneck(d.biggestBottleneck as string);
      if (d.missionStatement) setMissionStatement(d.missionStatement as string);
      if (d.whyThisWeekMatters) setWhyThisWeekMatters((d.whyThisWeekMatters as string) ?? "");
      if (d.dreamStatement) setDreamStatement((d.dreamStatement as string) ?? "");
      if (d.fuelStatement) setFuelStatement((d.fuelStatement as string) ?? "");
      if (Array.isArray(d.prioritySuggestions) && d.prioritySuggestions.length > 0) {
        for (const title of d.prioritySuggestions) {
          try {
            const priority = await fetchJsonThrow<Priority>("/api/ops/strategy-week/priorities", {
              method: "POST",
              body: JSON.stringify({ title }),
            });
            setData((prev) =>
              prev ? { ...prev, priorities: [...(prev.priorities ?? []), priority] } : null
            );
          } catch { /* skip individual priority failures */ }
        }
      }
      return d;
    },
    { toast: toastFn, successMessage: "Strategy filled. Review and save if correct." },
  );

  const { execute: handleAddPriority, pending: addingPriority } = useAsyncAction(
    async () => {
      if (!newPriorityTitle.trim() || !data) throw new Error("Title is required");
      return fetchJsonThrow<Priority>("/api/ops/strategy-week/priorities", {
        method: "POST",
        body: JSON.stringify({ title: newPriorityTitle.trim() }),
      });
    },
    {
      toast: toastFn,
      onSuccess: (priority) => {
        setData((d) => d ? { ...d, priorities: [...(d.priorities ?? []), priority] } : null);
        setNewPriorityTitle("");
      },
    },
  );

  const { execute: handleSaveReview, pending: savingReview } = useAsyncAction(
    async () =>
      fetchJsonThrow("/api/ops/strategy-week/review", {
        method: "PATCH",
        body: JSON.stringify({
          campaignShipped,
          systemImproved,
          salesActionsDone,
          proofCaptured,
          biggestBottleneck: biggestBottleneck || undefined,
          nextAutomation: nextAutomation || undefined,
        }),
      }),
    {
      toast: toastFn,
      successMessage: "Review saved",
      onSuccess: (review) => {
        if (data) setData({ ...data, review: review as StrategyWeek["review"] });
      },
    },
  );

  const warnings: string[] = [];
  if (!activeCampaignName?.trim()) warnings.push("No active campaign — growth is drifting.");
  if (!operatorImprovementFocus?.trim()) warnings.push("No leverage/system improvement set this week.");
  if (!salesTarget?.trim()) warnings.push("No sales target set — pipeline may drift.");
  const reviewCount = [campaignShipped, systemImproved, salesActionsDone, proofCaptured].filter(Boolean).length;
  const now = new Date();
  const dayOfWeek = now.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  if (isWeekend && reviewCount === 0 && data) {
    warnings.push("Week ending — review not filled (0/4 checks).");
  }

  const summaryTarget = weeklyTargetValue && weeklyTargetUnit ? `${weeklyTargetValue} ${weeklyTargetUnit}` : declaredCommitment?.slice(0, 80) ?? null;
  const summaryMetric = keyMetric ? `${keyMetric}${keyMetricTarget ? ` → ${keyMetricTarget}` : ""}` : null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Strategy Quadrant</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Weekly focus across: Next Innovative Campaign (Exponential), Leadership/Operator Development (Exponential),
          Operating System (Linear), Biz Dev & Sales (Linear).
        </p>
      </div>
      <ConfirmDialog {...dialogProps} />
      <AsyncState loading={loading} error={error} empty={!loading && !error && !data && history.length === 0} emptyMessage="No strategy data" onRetry={fetchInitial}>

      {(summaryTarget || summaryMetric || fuelStatement) && (
        <section className="rounded-lg border border-neutral-700 bg-neutral-900/30 px-4 py-3 flex flex-wrap gap-4 text-sm">
          {summaryTarget && (
            <div>
              <span className="text-neutral-500">Weekly target:</span>{" "}
              <span className="text-neutral-200">{summaryTarget}</span>
            </div>
          )}
          {summaryMetric && (
            <div>
              <span className="text-neutral-500">Key metric:</span>{" "}
              <span className="text-neutral-200">{summaryMetric}</span>
            </div>
          )}
          {fuelStatement && (
            <div className="min-w-0 flex-1">
              <span className="text-neutral-500">Fuel:</span>{" "}
              <span className="text-neutral-200 line-clamp-1">{fuelStatement}</span>
            </div>
          )}
        </section>
      )}

      {warnings.length > 0 && (
        <section className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-4">
          <h2 className="text-sm font-medium text-amber-200/90 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Warnings
          </h2>
          <ul className="text-sm text-amber-100/90 space-y-1">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-neutral-300">Current week</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleAiFill()}
            disabled={aiFilling}
            className="gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {aiFilling ? "Filling…" : "AI fill"}
          </Button>
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <label className="block text-neutral-500 text-xs uppercase tracking-wider mb-1">Phase</label>
            <select
              value={phase}
              onChange={(e) => setPhase(e.target.value)}
              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-100"
            >
              <option value="">— Select —</option>
              {PHASES.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="border-t border-neutral-700 pt-3 mt-3">
            <p className="text-neutral-400 font-medium mb-2">Next Innovative Campaign</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="block text-neutral-500 text-xs mb-1">Campaign name</label>
                <Input
                  value={activeCampaignName}
                  onChange={(e) => setActiveCampaignName(e.target.value)}
                  placeholder="e.g. Q1 Operator Audit"
                />
              </div>
              <div>
                <label className="block text-neutral-500 text-xs mb-1">Audience</label>
                <Input
                  value={activeCampaignAudience}
                  onChange={(e) => setActiveCampaignAudience(e.target.value)}
                  placeholder="e.g. tech founders"
                />
              </div>
              <div>
                <label className="block text-neutral-500 text-xs mb-1">Channel</label>
                <Input
                  value={activeCampaignChannel}
                  onChange={(e) => setActiveCampaignChannel(e.target.value)}
                  placeholder="e.g. LinkedIn, newsletter"
                />
              </div>
              <div>
                <label className="block text-neutral-500 text-xs mb-1">Offer</label>
                <Input
                  value={activeCampaignOffer}
                  onChange={(e) => setActiveCampaignOffer(e.target.value)}
                  placeholder="e.g. 30-min audit"
                />
              </div>
              <div>
                <label className="block text-neutral-500 text-xs mb-1">CTA</label>
                <Input
                  value={activeCampaignCta}
                  onChange={(e) => setActiveCampaignCta(e.target.value)}
                  placeholder="e.g. Book a call"
                />
              </div>
              <div>
                <label className="block text-neutral-500 text-xs mb-1">Proof angle</label>
                <Input
                  value={activeCampaignProof}
                  onChange={(e) => setActiveCampaignProof(e.target.value)}
                  placeholder="e.g. before/after screenshots"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-neutral-500 text-xs uppercase tracking-wider mb-1">
              Leadership / Operator Development (leverage focus)
            </label>
            <Textarea
              value={operatorImprovementFocus}
              onChange={(e) => setOperatorImprovementFocus(e.target.value)}
              placeholder="This week's leverage/system improvement"
              rows={2}
              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-neutral-500 text-xs uppercase tracking-wider mb-1">Biz Dev & Sales target</label>
            <Input
              value={salesTarget}
              onChange={(e) => setSalesTarget(e.target.value)}
              placeholder="e.g. 10 follow-ups / 2 calls"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="block text-neutral-500 text-xs mb-1">Theme</label>
              <Input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="e.g. Pipeline push" />
            </div>
            <div>
              <label className="block text-neutral-500 text-xs mb-1">Monthly focus</label>
              <Input value={monthlyFocus} onChange={(e) => setMonthlyFocus(e.target.value)} placeholder="e.g. Close 2 deals" />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="block text-neutral-500 text-xs mb-1">Weekly target value</label>
              <Input
                type="number"
                value={weeklyTargetValue}
                onChange={(e) => setWeeklyTargetValue(e.target.value)}
                placeholder="e.g. 10"
              />
            </div>
            <div>
              <label className="block text-neutral-500 text-xs mb-1">Unit</label>
              <Input
                value={weeklyTargetUnit}
                onChange={(e) => setWeeklyTargetUnit(e.target.value)}
                placeholder="e.g. calls, proposals"
              />
            </div>
          </div>
          <div>
            <label className="block text-neutral-500 text-xs mb-1">Declared commitment</label>
            <Textarea
              value={declaredCommitment}
              onChange={(e) => setDeclaredCommitment(e.target.value)}
              placeholder="What you commit to this week"
              rows={2}
              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-neutral-500 text-xs uppercase tracking-wider mb-1">Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Other notes"
              rows={2}
              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
            />
          </div>

          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving…" : "Save strategy"}
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">Logic + Emotion</h2>
        <p className="text-xs text-neutral-500 mb-4">
          PBD-style pairs: logic drives execution, emotion fuels it.
        </p>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Logic</h3>
            <div>
              <label className="block text-neutral-500 text-xs mb-1">Weekly target</label>
              <p className="text-sm text-neutral-300">
                {weeklyTargetValue && weeklyTargetUnit
                  ? `${weeklyTargetValue} ${weeklyTargetUnit}`
                  : "— Set above"}
              </p>
            </div>
            <div>
              <label className="block text-neutral-500 text-xs mb-1">Key metric</label>
              <Input
                value={keyMetric}
                onChange={(e) => setKeyMetric(e.target.value)}
                placeholder="e.g. pipeline value, calls, proposals"
              />
            </div>
            <div>
              <label className="block text-neutral-500 text-xs mb-1">Key metric target</label>
              <Input
                value={keyMetricTarget}
                onChange={(e) => setKeyMetricTarget(e.target.value)}
                placeholder="e.g. 10 calls, $5k pipeline"
              />
            </div>
            <div>
              <label className="block text-neutral-500 text-xs mb-1">Top priorities</label>
              <p className="text-sm text-neutral-400">
                {data?.priorities?.length ? `${data.priorities.length} set below` : "— Add below"}
              </p>
            </div>
            <div>
              <label className="block text-neutral-500 text-xs mb-1">Anticipated bottleneck</label>
              <Input
                value={anticipatedBottleneck}
                onChange={(e) => setAnticipatedBottleneck(e.target.value)}
                placeholder="What might block you?"
              />
            </div>
            <div>
              <label className="block text-neutral-500 text-xs mb-1">Actual bottleneck (from review)</label>
              <p className="text-sm text-neutral-400">
                {biggestBottleneck ? biggestBottleneck : "— Fill in review"}
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Emotion</h3>
            <div>
              <label className="block text-neutral-500 text-xs mb-1">Mission statement</label>
              <Textarea
                value={missionStatement}
                onChange={(e) => setMissionStatement(e.target.value)}
                placeholder="Short mission (1–2 sentences)"
                rows={2}
                className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-neutral-500 text-xs mb-1">Why this week matters</label>
              <Textarea
                value={whyThisWeekMatters}
                onChange={(e) => setWhyThisWeekMatters(e.target.value)}
                placeholder="What stakes or meaning drives this week"
                rows={2}
                className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-neutral-500 text-xs mb-1">Dream statement</label>
              <Textarea
                value={dreamStatement}
                onChange={(e) => setDreamStatement(e.target.value)}
                placeholder="Outcome you are building toward"
                rows={2}
                className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-neutral-500 text-xs mb-1">Fuel statement</label>
              <Textarea
                value={fuelStatement}
                onChange={(e) => setFuelStatement(e.target.value)}
                placeholder="Problem to beat / motivation (enemy reframed)"
                rows={2}
                className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="mt-4">
          {saving ? "Saving…" : "Save strategy"}
        </Button>
      </section>

      {data && (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-neutral-300 mb-3">Priorities</h2>
          <div className="space-y-2 mb-3">
            {(data.priorities ?? []).map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <select
                  value={p.status}
                  onChange={async (e) => {
                    const status = e.target.value as "todo" | "in_progress" | "done" | "blocked";
                    try {
                      const updated = await fetchJsonThrow<Priority>(`/api/ops/strategy-week/priorities/${p.id}`, {
                        method: "PATCH",
                        body: JSON.stringify({ status }),
                      });
                      setData((d) =>
                        d ? { ...d, priorities: (d.priorities ?? []).map((x) => (x.id === p.id ? updated : x)) } : null
                      );
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Update failed");
                    }
                  }}
                  className="rounded border border-neutral-600 bg-neutral-900 px-2 py-1 text-xs"
                >
                  <option value="todo">To do</option>
                  <option value="in_progress">In progress</option>
                  <option value="done">Done</option>
                  <option value="blocked">Blocked</option>
                </select>
                <span className={p.status === "done" ? "text-neutral-500 line-through" : "text-neutral-300"}>
                  {p.title}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    if (!(await confirm({ title: "Remove this priority?", variant: "destructive" }))) return;
                    try {
                      await fetchJsonThrow(`/api/ops/strategy-week/priorities/${p.id}`, { method: "DELETE" });
                      setData((d) => d ? { ...d, priorities: (d.priorities ?? []).filter((x) => x.id !== p.id) } : null);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Remove failed");
                    }
                  }}
                  className="ml-auto text-neutral-500 hover:text-red-400 text-xs"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newPriorityTitle}
              onChange={(e) => setNewPriorityTitle(e.target.value)}
              placeholder="New priority…"
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void handleAddPriority())}
            />
            <Button
              size="sm"
              onClick={() => void handleAddPriority()}
              disabled={addingPriority || !newPriorityTitle.trim()}
            >
              {addingPriority ? "Adding…" : "Add"}
            </Button>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">Weekly review</h2>
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={campaignShipped}
                onChange={(e) => setCampaignShipped(e.target.checked)}
                className="rounded border-neutral-600"
              />
              <span>Campaign shipped</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={systemImproved}
                onChange={(e) => setSystemImproved(e.target.checked)}
                className="rounded border-neutral-600"
              />
              <span>System improved</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={salesActionsDone}
                onChange={(e) => setSalesActionsDone(e.target.checked)}
                className="rounded border-neutral-600"
              />
              <span>Sales actions done</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={proofCaptured}
                onChange={(e) => setProofCaptured(e.target.checked)}
                className="rounded border-neutral-600"
              />
              <span>Proof captured</span>
            </label>
          </div>
          <div>
            <label className="block text-neutral-500 text-xs mb-1">Biggest bottleneck</label>
            <Input
              value={biggestBottleneck}
              onChange={(e) => setBiggestBottleneck(e.target.value)}
              placeholder="What blocked you most?"
            />
          </div>
          <div>
            <label className="block text-neutral-500 text-xs mb-1">Next automation</label>
            <Input
              value={nextAutomation}
              onChange={(e) => setNextAutomation(e.target.value)}
              placeholder="What to automate next?"
            />
          </div>
          <Button onClick={() => void handleSaveReview()} disabled={savingReview} variant="outline">
            {savingReview ? "Saving…" : "Save review"}
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">Recent history</h2>
        <div className=" overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-neutral-500 text-xs uppercase tracking-wider">
                <th className="pb-2 pr-4">Week</th>
                <th className="pb-2 pr-4">Phase</th>
                <th className="pb-2 pr-4">Campaign</th>
                <th className="pb-2 pr-4">Review</th>
                <th className="pb-2">Bottleneck</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.weekStart} className="border-t border-neutral-800">
                  <td className="py-2 pr-4 text-neutral-300">
                    {new Date(h.weekStart).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="py-2 pr-4 text-neutral-400">{h.phase || "—"}</td>
                  <td className="py-2 pr-4 text-neutral-400">{h.activeCampaignName || "—"}</td>
                  <td className="py-2 pr-4 text-neutral-400">
                    {h.reviewChecks}/{h.reviewTotal}
                  </td>
                  <td className="py-2 text-neutral-500 truncate max-w-[120px]">{h.biggestBottleneck || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {history.length === 0 && <p className="text-xs text-neutral-500 py-2">No history yet.</p>}
      </section>
      </AsyncState>
    </div>
  );
}
