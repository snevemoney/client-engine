"use client";

import { useState, useEffect } from "react";
import {
  getTrustToCloseFromMeta,
  TRUST_TO_CLOSE_ITEMS,
  type TrustToCloseChecklist,
} from "@/lib/proposals/trustToCloseChecklist";
import { CheckCircle, Circle } from "lucide-react";

interface TrustToCloseChecklistPanelProps {
  artifactId: string;
  meta: unknown;
  onUpdate?: (updatedMeta: Record<string, unknown>) => void;
  compact?: boolean;
}

export function TrustToCloseChecklistPanel({
  artifactId,
  meta,
  onUpdate,
  compact,
}: TrustToCloseChecklistPanelProps) {
  const [checklist, setChecklist] = useState<TrustToCloseChecklist>(() => getTrustToCloseFromMeta(meta));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setChecklist(getTrustToCloseFromMeta(meta));
  }, [meta]);

  async function toggle(key: keyof TrustToCloseChecklist, value: boolean) {
    const next = { ...checklist, [key]: value };
    setChecklist(next);
    setSaving(true);
    try {
      const res = await fetch(`/api/artifacts/${artifactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meta: { trustToCloseChecklist: next },
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        onUpdate?.(updated.meta as Record<string, unknown>);
      }
    } catch {
      setChecklist(getTrustToCloseFromMeta(meta));
    }
    setSaving(false);
  }

  const completed = TRUST_TO_CLOSE_ITEMS.filter(({ key }) => checklist[key] === true).length;
  const total = TRUST_TO_CLOSE_ITEMS.length;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/30 p-4">
      <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
        Trust-to-close checklist {completed === total && total > 0 && "✓"}
      </h3>
      <p className="text-[10px] text-neutral-600 mb-2">
        Problem understood, trust signals, risk reduced, unknowns stated, next step clear. Stored with proposal.
      </p>
      <ul className={compact ? "space-y-1" : "space-y-2"}>
        {TRUST_TO_CLOSE_ITEMS.map(({ key, label }) => (
          <li key={key}>
            <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
              <button
                type="button"
                onClick={() => toggle(key, checklist[key] !== true)}
                disabled={saving}
                className="flex-shrink-0"
              >
                {checklist[key] === true ? (
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Circle className="w-4 h-4 text-neutral-600" />
                )}
              </button>
              <span>{label}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-neutral-600 mt-2">
        {completed}/{total} complete
      </p>
    </div>
  );
}
