"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Save, Loader2 } from "lucide-react";

type OutcomeData = {
  id: string;
  projectId: string;
  actualRevenue: number | null;
  repeatClient: boolean;
  referralSource: string | null;
  satisfactionScore: number | null;
  lessonsLearned: string | null;
};

export function OutcomeEditor({
  projectId,
  onUpdate,
}: {
  projectId: string;
  onUpdate: () => void;
}) {
  const [actualRevenueDollars, setActualRevenueDollars] = useState("");
  const [repeatClient, setRepeatClient] = useState(false);
  const [referralSource, setReferralSource] = useState("");
  const [satisfactionScore, setSatisfactionScore] = useState<number | "">("");
  const [lessonsLearned, setLessonsLearned] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/outcome`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: OutcomeData | null) => {
        if (cancelled) return;
        if (data) {
          setActualRevenueDollars(
            data.actualRevenue != null ? String(data.actualRevenue / 100) : ""
          );
          setRepeatClient(data.repeatClient);
          setReferralSource(data.referralSource ?? "");
          setSatisfactionScore(data.satisfactionScore ?? "");
          setLessonsLearned(data.lessonsLearned ?? "");
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function save() {
    setSaving(true);
    try {
      const actualRevenue =
        actualRevenueDollars.trim() !== ""
          ? Math.round(parseFloat(actualRevenueDollars) * 100)
          : null;
      if (actualRevenue !== null && (isNaN(actualRevenue) || actualRevenue < 0)) {
        return;
      }
      const body = {
        actualRevenue,
        repeatClient,
        referralSource: referralSource.trim() || null,
        satisfactionScore:
          satisfactionScore !== "" && satisfactionScore >= 1 && satisfactionScore <= 5
            ? satisfactionScore
            : null,
        lessonsLearned: lessonsLearned.trim() || null,
      };
      const res = await fetch(`/api/projects/${projectId}/outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) onUpdate();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 bg-neutral-900/50 rounded-lg border border-neutral-800 text-sm text-neutral-500">
        Loading outcome…
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 bg-neutral-900/50 rounded-lg border border-neutral-800">
      <h3 className="text-sm font-medium text-neutral-300">Outcome ledger</h3>
      <p className="text-xs text-neutral-500">
        Record actual deal outcomes for score calibration and channel tuning.
      </p>

      <div>
        <label className="block text-xs text-neutral-500 mb-1">
          Actual revenue ($)
        </label>
        <Input
          type="number"
          min={0}
          step={0.01}
          value={actualRevenueDollars}
          onChange={(e) => setActualRevenueDollars(e.target.value)}
          placeholder="e.g. 12000"
          className="bg-neutral-900 border-neutral-700 text-sm"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={`repeat-${projectId}`}
          checked={repeatClient}
          onChange={(e) => setRepeatClient(e.target.checked)}
          className="rounded border-neutral-600 bg-neutral-900"
        />
        <label
          htmlFor={`repeat-${projectId}`}
          className="text-sm text-neutral-300"
        >
          Repeat client
        </label>
      </div>

      <div>
        <label className="block text-xs text-neutral-500 mb-1">
          Referral source (optional)
        </label>
        <Input
          value={referralSource}
          onChange={(e) => setReferralSource(e.target.value)}
          placeholder="e.g. LinkedIn post, past client"
          className="bg-neutral-900 border-neutral-700 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs text-neutral-500 mb-1">
          Satisfaction (1–5)
        </label>
        <select
          value={satisfactionScore}
          onChange={(e) =>
            setSatisfactionScore(
              e.target.value === "" ? "" : Number(e.target.value)
            )
          }
          className="rounded px-2 py-1.5 text-sm bg-neutral-900 border border-neutral-700 text-neutral-200"
        >
          <option value="">—</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-neutral-500 mb-1">
          Lessons learned (optional)
        </label>
        <Textarea
          value={lessonsLearned}
          onChange={(e) => setLessonsLearned(e.target.value)}
          placeholder="What worked, what to avoid next time"
          rows={3}
          className="bg-neutral-900 border-neutral-700 text-sm resize-none"
        />
      </div>

      <Button size="sm" variant="outline" onClick={save} disabled={saving}>
        {saving ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Save className="w-3.5 h-3.5" />
        )}
        Save
      </Button>
    </div>
  );
}
