"use client";

import { useState, useEffect } from "react";
import { Package, Plus } from "lucide-react";

const ASSET_TYPES = [
  "template",
  "component",
  "workflow",
  "prompt_pack",
  "checklist",
  "case_study",
  "prompt_pattern",
  "sales_script",
  "sop_playbook",
  "none",
] as const;

const CAN_PRODUCTIZE = ["yes", "no", "maybe"] as const;

type ReusableAssetLogEntry = {
  id: string;
  assetType: string;
  label: string | null;
  reasonNone: string | null;
  notes: string | null;
  reusabilityScore: number | null;
  whereStored: string | null;
  canProductize: string | null;
  createdAt: string;
};

export function ReusableAssetLogCard({ leadId }: { leadId: string }) {
  const [logs, setLogs] = useState<ReusableAssetLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [assetType, setAssetType] = useState<string>("template");
  const [label, setLabel] = useState("");
  const [reasonNone, setReasonNone] = useState("");
  const [notes, setNotes] = useState("");
  const [reusabilityScore, setReusabilityScore] = useState<number | "">(3);
  const [whereStored, setWhereStored] = useState("");
  const [canProductize, setCanProductize] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/leads/${leadId}/reusable-assets`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setLogs(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, [leadId]);

  async function submitLog() {
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/reusable-assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetType,
          label: assetType === "none" ? "None" : (label.trim() || null),
          reasonNone: assetType === "none" ? (reasonNone.trim() || "Not extracted") : null,
          notes: notes.trim() || null,
          reusabilityScore: reusabilityScore === "" ? undefined : Number(reusabilityScore),
          whereStored: whereStored.trim() || null,
          canProductize: canProductize || null,
        }),
      });
      if (res.ok) {
        const entry = await res.json();
        setLogs((prev) => [entry, ...prev]);
        setLabel("");
        setReasonNone("");
        setNotes("");
        setReusabilityScore(3);
        setWhereStored("");
        setCanProductize("");
        setShowForm(false);
      } else {
        const err = await res.json();
        alert(err.error ?? "Failed to add");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  return (
    <div className="border border-neutral-800 rounded-lg p-4">
      <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-2">
        <Package className="w-3.5 h-3.5" />
        Reusable leverage (per project)
      </h3>
      <p className="text-xs text-neutral-500 mb-3">
        Asset extracted? Log type, reusability (1–5), where stored, can productize later. Human-driven; no auto-extraction.
      </p>
      {logs.length > 0 && (
        <ul className="space-y-2 mb-3">
          {logs.map((log) => (
            <li key={log.id} className="flex flex-wrap items-start gap-2 text-sm">
              <span className="font-medium text-neutral-300 capitalize">{log.assetType.replace(/_/g, " ")}</span>
              {log.assetType === "none" ? (
                <span className="text-neutral-500">— {log.reasonNone ?? "No asset"}</span>
              ) : (
                <>
                  {log.label && <span className="text-neutral-400">{log.label}</span>}
                  {log.reusabilityScore != null && <span className="text-neutral-500">· {log.reusabilityScore}/5</span>}
                  {log.whereStored && <span className="text-neutral-500 truncate" title={log.whereStored}>· {log.whereStored}</span>}
                  {log.canProductize && <span className="text-neutral-500">· Productize: {log.canProductize}</span>}
                </>
              )}
              {log.notes && <span className="text-neutral-500 w-full">· {log.notes}</span>}
              <span className="text-xs text-neutral-500 shrink-0">{new Date(log.createdAt).toLocaleDateString("en-US")}</span>
            </li>
          ))}
        </ul>
      )}
      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1 rounded border border-neutral-600 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
        >
          <Plus className="w-3 h-3" /> Log reusable asset
        </button>
      ) : (
        <div className="space-y-2 pt-2 border-t border-neutral-800">
          <p className="text-xs text-neutral-500">Asset extracted? Choose type or &quot;None&quot;.</p>
          <div className="flex gap-2 flex-wrap">
            <select
              value={assetType}
              onChange={(e) => setAssetType(e.target.value)}
              className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-200"
            >
              {ASSET_TYPES.map((t) => (
                <option key={t} value={t}>{t === "none" ? "None (no asset extracted)" : t.replace(/_/g, " ")}</option>
              ))}
            </select>
            {assetType !== "none" && (
              <>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Short label (optional)"
                  className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-200 w-48"
                />
                <select
                  value={reusabilityScore === "" ? "" : reusabilityScore}
                  onChange={(e) => setReusabilityScore(e.target.value === "" ? "" : Number(e.target.value))}
                  className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-200"
                >
                  <option value="">Reusability (1-5)</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={whereStored}
                  onChange={(e) => setWhereStored(e.target.value)}
                  placeholder="Where stored (path/link)"
                  className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-200 min-w-[180px]"
                />
                <select
                  value={canProductize}
                  onChange={(e) => setCanProductize(e.target.value)}
                  className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-200"
                >
                  <option value="">Can productize?</option>
                  {CAN_PRODUCTIZE.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </>
            )}
            {assetType === "none" && (
              <input
                type="text"
                value={reasonNone}
                onChange={(e) => setReasonNone(e.target.value)}
                placeholder="Reason (e.g. one-off, not reusable)"
                className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-200 min-w-[200px]"
              />
            )}
          </div>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes: what makes it reusable (optional)"
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-200"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submitLog}
              disabled={saving || (assetType === "none" && !reasonNone.trim())}
              className="rounded-md bg-neutral-100 text-neutral-900 px-3 py-1.5 text-sm font-medium hover:bg-neutral-200 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-neutral-600 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
