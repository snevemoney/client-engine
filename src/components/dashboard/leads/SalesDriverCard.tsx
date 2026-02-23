"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { getQualificationTotal, getPriorityBadge } from "@/lib/sales-driver/qualification";
import { getMessageAngle } from "@/lib/sales-driver/messageAngle";

const DRIVER_TYPES = ["survival", "status", "freedom", "cause", "competition", "enemy", "unknown"] as const;
const SCORE_LABELS = ["Pain", "Urgency", "Budget", "Responsiveness", "Decision Maker", "Fit"] as const;
const SCORE_KEYS = ["scorePain", "scoreUrgency", "scoreBudget", "scoreResponsiveness", "scoreDecisionMaker", "scoreFit"] as const;

type DriverLead = {
  id: string;
  driverType: string | null;
  driverReason: string | null;
  desiredResult: string | null;
  resultDeadline: string | null;
  nextAction: string | null;
  nextActionDueAt: string | null;
  proofAngle: string | null;
  scorePain: number | null;
  scoreUrgency: number | null;
  scoreBudget: number | null;
  scoreResponsiveness: number | null;
  scoreDecisionMaker: number | null;
  scoreFit: number | null;
};

interface SalesDriverCardProps {
  leadId: string;
  lead: DriverLead;
  onUpdate: () => void;
}

export function SalesDriverCard({ leadId, lead, onUpdate }: SalesDriverCardProps) {
  const [saving, setSaving] = useState(false);
  const [savingQual, setSavingQual] = useState(false);
  const [driverType, setDriverType] = useState(lead.driverType ?? "");
  const [driverReason, setDriverReason] = useState(lead.driverReason ?? "");
  const [desiredResult, setDesiredResult] = useState(lead.desiredResult ?? "");
  const [resultDeadline, setResultDeadline] = useState(lead.resultDeadline ? lead.resultDeadline.slice(0, 10) : "");
  const [proofAngle, setProofAngle] = useState(lead.proofAngle ?? "");
  const [nextAction, setNextAction] = useState(lead.nextAction ?? "");
  const [nextActionDueAt, setNextActionDueAt] = useState(
    lead.nextActionDueAt ? lead.nextActionDueAt.slice(0, 16) : ""
  );
  const [scores, setScores] = useState({
    scorePain: lead.scorePain ?? null,
    scoreUrgency: lead.scoreUrgency ?? null,
    scoreBudget: lead.scoreBudget ?? null,
    scoreResponsiveness: lead.scoreResponsiveness ?? null,
    scoreDecisionMaker: lead.scoreDecisionMaker ?? null,
    scoreFit: lead.scoreFit ?? null,
  });

  const total = getQualificationTotal(scores);
  const badge = getPriorityBadge(total);
  const badgeVariant = badge === "High" ? "success" : badge === "Medium" ? "warning" : "default";

  const handleSaveDriver = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/driver`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverType: driverType || null,
          driverReason: driverReason || null,
          desiredResult: desiredResult || null,
          resultDeadline: resultDeadline || null,
          proofAngle: proofAngle || null,
          nextAction: nextAction || null,
          nextActionDueAt: nextActionDueAt || null,
        }),
      });
      if (res.ok) onUpdate();
      else {
        const err = await res.json();
        alert(err.error ?? "Save failed");
      }
    } catch {
      alert("Save failed");
    }
    setSaving(false);
  };

  const handleSaveQualification = async () => {
    setSavingQual(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/qualification`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scores),
      });
      if (res.ok) onUpdate();
      else {
        const err = await res.json();
        alert(err.error ?? "Save failed");
      }
    } catch {
      alert("Save failed");
    }
    setSavingQual(false);
  };

  const angle = getMessageAngle(driverType || null);

  return (
    <div className="border border-neutral-800 rounded-lg p-4 space-y-4">
      <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Sales Driver</h3>

      {/* Message angle helper */}
      <div className="rounded-md bg-neutral-800/60 border border-neutral-700/60 p-3 text-sm text-neutral-300">
        <strong className="text-neutral-400">Message angle:</strong> {angle}
      </div>

      <div className="space-y-3 text-sm">
        <div>
          <label className="text-xs text-neutral-500 block mb-1">Driver Type</label>
          <select
            value={driverType}
            onChange={(e) => setDriverType(e.target.value)}
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200"
          >
            <option value="">— Select —</option>
            {DRIVER_TYPES.map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1">Reason (why they care)</label>
          <Textarea
            value={driverReason}
            onChange={(e) => setDriverReason(e.target.value)}
            placeholder="Emotional/business driver"
            rows={2}
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1">Desired Result</label>
          <Input
            value={desiredResult}
            onChange={(e) => setDesiredResult(e.target.value)}
            placeholder="What they want to happen"
            className="w-full"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1">Result Deadline</label>
          <Input
            type="date"
            value={resultDeadline}
            onChange={(e) => setResultDeadline(e.target.value)}
            className="w-full"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1">Proof Angle</label>
          <Input
            value={proofAngle}
            onChange={(e) => setProofAngle(e.target.value)}
            placeholder="How to frame trust/proof for this lead"
            className="w-full"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1">Next Action</label>
          <Input
            value={nextAction}
            onChange={(e) => setNextAction(e.target.value)}
            placeholder="e.g. Send follow-up email"
            className="w-full"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1">Next Action Due</label>
          <Input
            type="datetime-local"
            value={nextActionDueAt}
            onChange={(e) => setNextActionDueAt(e.target.value)}
            className="w-full"
          />
        </div>
        <Button onClick={handleSaveDriver} disabled={saving} size="sm">
          {saving ? "Saving…" : "Save driver"}
        </Button>
      </div>

      {/* Qualification */}
      <div className="border-t border-neutral-700 pt-4">
        <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">Qualification (0–2 each)</h4>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SCORE_LABELS.map((label, i) => (
            <div key={label}>
              <label className="text-xs text-neutral-500 block mb-1">{label}</label>
              <select
                value={scores[SCORE_KEYS[i]] ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setScores((s) => ({ ...s, [SCORE_KEYS[i]]: v === "" ? null : parseInt(v, 10) }));
                }}
                className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
              >
                <option value="">—</option>
                <option value="0">0</option>
                <option value="1">1</option>
                <option value="2">2</option>
              </select>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm text-neutral-400">Total:</span>
          <Badge variant={badgeVariant}>{total}/12 — {badge}</Badge>
        </div>
        <Button onClick={handleSaveQualification} disabled={savingQual} size="sm" variant="outline" className="mt-2">
          {savingQual ? "Saving…" : "Save qualification"}
        </Button>
      </div>
    </div>
  );
}
