"use client";

import { useState, useEffect } from "react";
import type { OpportunityBrief } from "@/lib/ops/types";

export function OpportunityBriefCard({ leadId }: { leadId: string }) {
  const [brief, setBrief] = useState<OpportunityBrief | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/leads/${leadId}/opportunity-brief`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setBrief(data);
      })
      .catch(() => { if (!cancelled) setBrief(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [leadId]);

  if (loading) return <div className="rounded-lg border border-neutral-800 p-4 text-sm text-neutral-500">Loading opportunity brief…</div>;
  if (!brief) return null;

  const rows = [
    { label: "Buyer", value: brief.buyer },
    { label: "Pain", value: brief.pain },
    { label: "Current stack", value: brief.currentStackSignals },
    { label: "Likely bottleneck", value: brief.likelyBottleneck },
    { label: "Offer fit", value: brief.offerFit },
    { label: "ROI / cost of inaction", value: brief.roiCostOfInaction },
    { label: "Pilot suggestion", value: brief.pilotSuggestion },
    { label: "Objections / risks", value: brief.objectionsRisks },
    { label: "Why now", value: brief.whyNow },
    { label: "Source evidence", value: brief.sourceEvidence },
  ].filter((r) => r.value);

  if (rows.length === 0 && brief.confidenceScore == null) return null;

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h3 className="text-sm font-medium text-neutral-300 mb-2 flex items-center gap-2">
        Opportunity brief
        {brief.confidenceScore != null && (
          <span className="text-xs font-normal text-neutral-500">Score {brief.confidenceScore}</span>
        )}
      </h3>
      <dl className="space-y-2 text-sm">
        {rows.map(({ label, value }) => (
          <div key={label}>
            <dt className="text-neutral-500 text-xs">{label}</dt>
            <dd className="text-neutral-200 mt-0.5 line-clamp-2">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
