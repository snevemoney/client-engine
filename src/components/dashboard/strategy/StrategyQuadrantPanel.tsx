"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle } from "lucide-react";

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

export function StrategyQuadrantPanel() {
  const [data, setData] = useState<StrategyWeek | null>(null);
  const [history, setHistory] = useState<
    { weekStart: string; phase: string | null; activeCampaignName: string | null; reviewChecks: number; reviewTotal: number; biggestBottleneck: string | null }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingReview, setSavingReview] = useState(false);

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

  useEffect(() => {
    Promise.all([
      fetch("/api/ops/strategy-week").then((r) => r.json()),
      fetch("/api/ops/strategy-week/history?weeks=8").then((r) => r.json()),
    ]).then(([weekRes, historyRes]) => {
      const week = weekRes?.id ? weekRes : null;
      setData(week);
      if (week) {
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
      }
      setHistory(historyRes?.items ?? []);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/ops/strategy-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setData(updated);
      } else {
        const err = await res.json();
        alert(err.error ?? "Save failed");
      }
    } catch (e) {
      alert("Save failed");
    }
    setSaving(false);
  };

  const handleSaveReview = async () => {
    setSavingReview(true);
    try {
      const res = await fetch("/api/ops/strategy-week/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignShipped,
          systemImproved,
          salesActionsDone,
          proofCaptured,
          biggestBottleneck: biggestBottleneck || undefined,
          nextAutomation: nextAutomation || undefined,
        }),
      });
      if (res.ok) {
        if (data) setData({ ...data, review: await res.json() });
      } else {
        const err = await res.json();
        alert(err.error ?? "Save review failed");
      }
    } catch {
      alert("Save review failed");
    }
    setSavingReview(false);
  };

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

  if (loading) {
    return (
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-sm font-medium text-neutral-300 mb-3">Strategy Quadrant</h2>
        <p className="text-xs text-neutral-500">Loading…</p>
      </section>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Strategy Quadrant</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Weekly focus across: Next Innovative Campaign (Exponential), Leadership/Operator Development (Exponential),
          Operating System (Linear), Biz Dev & Sales (Linear).
        </p>
      </div>

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
        <h2 className="text-sm font-medium text-neutral-300 mb-3">Current week</h2>
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

          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save strategy"}
          </Button>
        </div>
      </section>

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
          <Button onClick={handleSaveReview} disabled={savingReview} variant="outline">
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
                    {new Date(h.weekStart).toLocaleDateString(undefined, {
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
    </div>
  );
}
