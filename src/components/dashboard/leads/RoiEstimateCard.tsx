"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { DollarSign, RefreshCw } from "lucide-react";

type RoiEstimate = {
  timeWasteEstimateHoursPerWeek: { min: number; max: number } | null;
  toolCostWastePerMonth: { min: number; max: number } | null;
  lostRevenueRiskPerMonth: { min: number; max: number } | null;
  implementationEffortEstimate: string;
  confidence: number;
  assumptions: string[];
  whyNow: string;
  pilotRecommendation: string;
  expectedPilotOutcome: string[];
};

export function RoiEstimateCard({ leadId, onRoiGenerated }: { leadId: string; onRoiGenerated?: () => void }) {
  const [estimate, setEstimate] = useState<RoiEstimate | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  function fetchRoi() {
    fetch(`/api/leads/${leadId}/roi`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.estimate) {
          setEstimate(data.estimate);
          setContent(data.content ?? null);
        } else {
          setEstimate(null);
          setContent(null);
        }
      })
      .catch(() => { setEstimate(null); setContent(null); })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchRoi();
  }, [leadId]);

  async function generateRoi() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/roi`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setEstimate(data.estimate);
        setContent(null);
        onRoiGenerated?.();
        fetchRoi();
      } else {
        const err = await res.json();
        alert(err.error ?? "Failed to generate ROI");
      }
    } catch (e) {
      alert("Request failed");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h3 className="text-sm font-medium text-neutral-300 mb-2">ROI Estimate</h3>
        <p className="text-sm text-neutral-500">Loading…</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-neutral-300 flex items-center gap-2">
          <DollarSign className="w-4 h-4" /> ROI Estimate
        </h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={generateRoi}
            disabled={generating}
            className="text-xs"
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${generating ? "animate-spin" : ""}`} />
            {estimate ? "Refresh ROI" : "Generate ROI"}
          </Button>
          {estimate && (
            <a href="#proposal-review" className="text-xs text-neutral-400 hover:text-neutral-200">
              Use in Proposal
            </a>
          )}
        </div>
      </div>
      {!estimate ? (
        <p className="text-sm text-neutral-500">
          No ROI estimate yet. Click Generate ROI to create one from lead and positioning data.
        </p>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-neutral-500">Confidence</span>
            <span className="font-medium text-neutral-200">{(estimate.confidence * 100).toFixed(0)}%</span>
          </div>
          {(estimate.timeWasteEstimateHoursPerWeek || estimate.toolCostWastePerMonth || estimate.lostRevenueRiskPerMonth) && (
            <div className="text-neutral-400">
              {estimate.timeWasteEstimateHoursPerWeek && (
                <p>Time waste: {estimate.timeWasteEstimateHoursPerWeek.min}–{estimate.timeWasteEstimateHoursPerWeek.max} hrs/week</p>
              )}
              {estimate.toolCostWastePerMonth && (
                <p>Tool cost waste: ${estimate.toolCostWastePerMonth.min}–${estimate.toolCostWastePerMonth.max}/mo</p>
              )}
              {estimate.lostRevenueRiskPerMonth && (
                <p>Lost revenue risk: ${estimate.lostRevenueRiskPerMonth.min}–${estimate.lostRevenueRiskPerMonth.max}/mo</p>
              )}
            </div>
          )}
          <div>
            <p className="text-neutral-500 text-xs uppercase tracking-wider mb-1">Why now</p>
            <p className="text-neutral-300">{estimate.whyNow}</p>
          </div>
          <div>
            <p className="text-neutral-500 text-xs uppercase tracking-wider mb-1">Pilot recommendation</p>
            <p className="text-neutral-300">{estimate.pilotRecommendation}</p>
          </div>
          {estimate.expectedPilotOutcome.length > 0 && (
            <ul className="list-disc list-inside text-neutral-400">
              {estimate.expectedPilotOutcome.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
          {estimate.assumptions.length > 0 && (
            <div>
              <p className="text-neutral-500 text-xs uppercase tracking-wider mb-1">Assumptions</p>
              <ul className="list-disc list-inside text-neutral-500 text-xs">
                {estimate.assumptions.slice(0, 5).map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
