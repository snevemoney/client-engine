"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OperatorSettings } from "@/lib/ops/settings";

export function CashAndGraduationSection({
  initialSettings,
}: {
  initialSettings: OperatorSettings;
}) {
  const [cashCollected, setCashCollected] = useState(
    initialSettings.cashCollected != null ? String(initialSettings.cashCollected) : ""
  );
  const [targetWins, setTargetWins] = useState(
    initialSettings.graduationTargetWins != null ? String(initialSettings.graduationTargetWins) : "10"
  );
  const [milestone, setMilestone] = useState(
    initialSettings.graduationMilestone ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMessage(null);
    const cash = cashCollected.trim() ? parseInt(cashCollected.replace(/\D/g, ""), 10) : undefined;
    const target = targetWins.trim() ? parseInt(targetWins.replace(/\D/g, ""), 10) : undefined;
    try {
      const res = await fetch("/api/ops/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...initialSettings,
          cashCollected: Number.isFinite(cash) ? cash : undefined,
          graduationTargetWins: Number.isFinite(target) ? target : undefined,
          graduationMilestone: milestone.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setMessage(data.error ?? "Save failed");
        return;
      }
      setMessage("Saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Request failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="border border-neutral-800 rounded-lg p-6 space-y-4">
      <h2 className="text-sm font-medium text-neutral-300">Cash & graduation</h2>
      <p className="text-xs text-neutral-500">
        Cash collected = money in bank (set weekly/monthly). Graduation trigger = repeatable wins (90d) before moving to productized. Shown on Command Center.
      </p>
      <div className="grid gap-3 text-sm">
        <div>
          <label className="text-neutral-500 text-xs block mb-1">Cash collected ($)</label>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="e.g. 12000"
            value={cashCollected}
            onChange={(e) => setCashCollected(e.target.value)}
            className="max-w-xs bg-neutral-900 border-neutral-700"
          />
        </div>
        <div>
          <label className="text-neutral-500 text-xs block mb-1">Graduation target (repeatable wins in 90d)</label>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="e.g. 10"
            value={targetWins}
            onChange={(e) => setTargetWins(e.target.value)}
            className="max-w-xs bg-neutral-900 border-neutral-700"
          />
        </div>
        <div>
          <label className="text-neutral-500 text-xs block mb-1">Next milestone (optional)</label>
          <Input
            type="text"
            placeholder="e.g. Productized offer readiness: 60%"
            value={milestone}
            onChange={(e) => setMilestone(e.target.value)}
            className="max-w-md bg-neutral-900 border-neutral-700"
          />
        </div>
      </div>
      <Button size="sm" onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
      {message && (
        <p className={`text-xs ${message === "Saved." ? "text-neutral-400" : "text-amber-400"}`}>
          {message}
        </p>
      )}
    </section>
  );
}
