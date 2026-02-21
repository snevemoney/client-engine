"use client";

import { useState } from "react";
import { ClipboardList } from "lucide-react";

type Brief = {
  at: string;
  summary: string;
  whatHappened: string[];
  whatWasCreated: string[];
  whatFailed: string[];
  needsApproval: string[];
  bottleneck: { label: string; reason: string; actions: string[] } | null;
  topOpportunities: string[];
  actionPlan: string[];
  counts: {
    newLeads: number;
    proposalsReady: number;
    approvalsNeeded: number;
    buildReady: number;
    failedRuns: number;
  };
};

export function BriefMeCard({ initialBrief }: { initialBrief: Brief | null }) {
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<Brief | null>(initialBrief);

  async function handleBrief() {
    setLoading(true);
    try {
      const res = await fetch("/api/ops/brief", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Brief failed");
      setBrief(data.brief);
    } catch (e) {
      setBrief(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-2">Review Results</h2>
      <p className="text-xs text-neutral-500 mb-3">
        What AI did while you were away: qualified leads, proposal drafts, failures, bottleneck, next actions.
      </p>
      <button
        onClick={handleBrief}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-md bg-neutral-100 text-neutral-900 px-3 py-2 text-sm font-medium hover:bg-neutral-200 disabled:opacity-50"
      >
        <ClipboardList className="w-4 h-4" />
        {loading ? "Generating…" : "Review Results"}
      </button>
      {brief && (
        <div className="mt-4 space-y-2 text-sm text-neutral-300 border-t border-neutral-800 pt-3">
          <p>{brief.summary}</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <span>Leads: {brief.counts.newLeads}</span>
            <span>Proposals ready: {brief.counts.proposalsReady}</span>
            <span>Build ready: {brief.counts.buildReady}</span>
            <span>Failed runs: {brief.counts.failedRuns}</span>
          </div>
          {brief.bottleneck && (
            <div className="rounded bg-amber-950/30 border border-amber-800/50 p-2 text-xs">
              <strong>Bottleneck:</strong> {brief.bottleneck.label} — {brief.bottleneck.reason}
              <br />
              Do next: {brief.bottleneck.actions.join("; ")}
            </div>
          )}
          {brief.actionPlan.length > 0 && (
            <ul className="list-disc list-inside text-xs">
              {brief.actionPlan.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
