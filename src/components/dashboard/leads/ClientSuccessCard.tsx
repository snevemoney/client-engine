"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Target,
  BarChart3,
  Wrench,
  TrendingUp,
  AlertTriangle,
  MessageSquare,
  FileText,
  Plus,
  Check,
} from "lucide-react";

type ResultTarget = {
  currentState: string;
  targetState: string;
  metric: string;
  timeline: string;
  capturedAt: string;
};

type BaselineSnapshot = {
  metrics: { name: string; value: string; unit?: string }[];
  notes?: string;
  capturedAt: string;
};

type InterventionEntry = {
  id: string;
  at: string;
  category: string;
  description: string;
  impact?: string;
};

type OutcomeEntry = {
  id: string;
  weekStart: string;
  metrics: { name: string; value: string; unit?: string; delta?: string }[];
  notes?: string;
};

type RiskItem = {
  id: string;
  at: string;
  description: string;
  severity?: string;
  resolvedAt?: string;
};

type ClientFeedbackEntry = {
  id: string;
  at: string;
  question?: string;
  response: string;
  themes?: string[];
};

type ClientSuccessData = {
  resultTarget: ResultTarget | null;
  baseline: BaselineSnapshot | null;
  interventions: InterventionEntry[];
  outcomeEntries: OutcomeEntry[];
  risks: RiskItem[];
  feedback: ClientFeedbackEntry[];
};

const INTERVENTION_CATEGORIES = ["automation", "workflow", "tool_stack", "process", "other"] as const;

export function ClientSuccessCard({
  leadId,
  onProofGenerated,
}: {
  leadId: string;
  onProofGenerated?: () => void;
}) {
  const [data, setData] = useState<ClientSuccessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [proofGenerating, setProofGenerating] = useState(false);

  // Form state
  const [rtCurrent, setRtCurrent] = useState("");
  const [rtTarget, setRtTarget] = useState("");
  const [rtMetric, setRtMetric] = useState("");
  const [rtTimeline, setRtTimeline] = useState("");
  const [baselineMetrics, setBaselineMetrics] = useState("");
  const [intCategory, setIntCategory] = useState<typeof INTERVENTION_CATEGORIES[number]>("automation");
  const [intDesc, setIntDesc] = useState("");
  const [intImpact, setIntImpact] = useState("");
  const [outWeekStart, setOutWeekStart] = useState("");
  const [outMetrics, setOutMetrics] = useState("");
  const [riskDesc, setRiskDesc] = useState("");
  const [feedbackResponse, setFeedbackResponse] = useState("");
  const [feedbackQuestion, setFeedbackQuestion] = useState("What still feels slow or confusing?");

  function fetchData() {
    fetch(`/api/leads/${leadId}/client-success`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setData(d ?? null);
        if (d?.resultTarget) {
          setRtCurrent(d.resultTarget.currentState);
          setRtTarget(d.resultTarget.targetState);
          setRtMetric(d.resultTarget.metric);
          setRtTimeline(d.resultTarget.timeline);
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchData();
  }, [leadId]);

  async function post(type: string, payload: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/client-success`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, payload }),
      });
      if (res.ok) {
        const updated = await res.json();
        setData(updated);
        setIntDesc("");
        setIntImpact("");
        setOutWeekStart("");
        setOutMetrics("");
        setRiskDesc("");
        setFeedbackResponse("");
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveResultTarget() {
    if (!rtCurrent.trim() || !rtTarget.trim() || !rtMetric.trim() || !rtTimeline.trim()) return;
    await post("result_target", {
      currentState: rtCurrent.trim(),
      targetState: rtTarget.trim(),
      metric: rtMetric.trim(),
      timeline: rtTimeline.trim(),
    });
  }

  async function saveBaseline() {
    const lines = baselineMetrics.split("\n").filter((l) => l.trim());
    const metrics = lines.map((l) => {
      const [name, rest] = l.split(":").map((s) => s.trim());
      const [value, unit] = (rest ?? "").split(/\s+/).filter(Boolean);
      return { name: name ?? "", value: value ?? "", unit: unit };
    }).filter((m) => m.name && m.value);
    if (metrics.length === 0) return;
    await post("baseline", { metrics, notes: undefined });
  }

  async function addIntervention() {
    if (!intDesc.trim()) return;
    await post("intervention", { category: intCategory, description: intDesc.trim(), impact: intImpact.trim() || undefined });
  }

  async function addOutcomeEntry() {
    if (!outWeekStart.trim() || !outMetrics.trim()) return;
    const metrics = outMetrics.split("\n").filter((l) => l.trim()).map((l) => {
      const [name, rest] = l.split(":").map((s) => s.trim());
      const [value, unit] = (rest ?? "").split(/\s+/).filter(Boolean);
      return { name: name ?? "", value: value ?? "", unit };
    }).filter((m) => m.name && m.value);
    if (metrics.length === 0) return;
    await post("outcome_entry", { weekStart: outWeekStart.trim(), metrics, notes: undefined });
  }

  async function addRisk() {
    if (!riskDesc.trim()) return;
    await post("risk", { description: riskDesc.trim() });
  }

  async function resolveRisk(riskId: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/client-success`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "resolve_risk", riskId }),
      });
      if (res.ok) {
        const updated = await res.json();
        setData(updated);
      }
    } finally {
      setSaving(false);
    }
  }

  async function addFeedback() {
    if (!feedbackResponse.trim()) return;
    await post("feedback", { question: feedbackQuestion.trim() || undefined, response: feedbackResponse.trim() });
  }

  async function generateProof() {
    setProofGenerating(true);
    try {
      const res = await fetch("/api/proof/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      if (res.ok) {
        onProofGenerated?.();
      }
    } finally {
      setProofGenerating(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <h3 className="text-sm font-medium text-neutral-300 mb-2">Client Success</h3>
        <p className="text-sm text-neutral-500">Loading…</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-300 flex items-center gap-2">
          <Target className="w-4 h-4" /> Client Success
        </h3>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={generateProof}
          disabled={proofGenerating}
        >
          <FileText className="w-3 h-3 mr-1" />
          {proofGenerating ? "Generating…" : "Generate proof from outcomes"}
        </Button>
      </div>

      {/* Result Target */}
      <div>
        <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-1">
          <Target className="w-3 h-3" /> Result Target
        </h4>
        <div className="grid gap-2 sm:grid-cols-2 text-sm">
          <Input placeholder="Current state (what sucks now)" value={rtCurrent} onChange={(e) => setRtCurrent(e.target.value)} className="bg-neutral-900 border-neutral-700" />
          <Input placeholder="Target state (what better looks like)" value={rtTarget} onChange={(e) => setRtTarget(e.target.value)} className="bg-neutral-900 border-neutral-700" />
          <Input placeholder="Metric (how we measure)" value={rtMetric} onChange={(e) => setRtMetric(e.target.value)} className="bg-neutral-900 border-neutral-700" />
          <Input placeholder="Timeline (e.g. 30 days)" value={rtTimeline} onChange={(e) => setRtTimeline(e.target.value)} className="bg-neutral-900 border-neutral-700" />
        </div>
        <Button size="sm" className="mt-2" onClick={saveResultTarget} disabled={saving}>Save result target</Button>
      </div>

      {/* Baseline */}
      <div>
        <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-1">
          <BarChart3 className="w-3 h-3" /> Baseline Snapshot
        </h4>
        {data?.baseline ? (
          <div className="text-sm text-neutral-400">
            {data.baseline.metrics.map((m, i) => (
              <div key={i}>{m.name}: {m.value}{m.unit ? ` ${m.unit}` : ""}</div>
            ))}
          </div>
        ) : (
          <>
            <Textarea
              placeholder="One per line: Name: value unit (e.g. Admin hours/week: 12 hrs)"
              value={baselineMetrics}
              onChange={(e) => setBaselineMetrics(e.target.value)}
              rows={3}
              className="bg-neutral-900 border-neutral-700 text-sm"
            />
            <Button size="sm" className="mt-2" onClick={saveBaseline} disabled={saving}>Capture baseline</Button>
          </>
        )}
      </div>

      {/* Interventions */}
      <div>
        <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-1">
          <Wrench className="w-3 h-3" /> Intervention Log
        </h4>
        <div className="flex gap-2 flex-wrap mb-2">
          {INTERVENTION_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setIntCategory(c)}
              className={`rounded px-2 py-1 text-xs ${intCategory === c ? "bg-neutral-700 text-neutral-100" : "bg-neutral-800/50 text-neutral-400"}`}
            >
              {c}
            </button>
          ))}
        </div>
        <Input placeholder="What you changed" value={intDesc} onChange={(e) => setIntDesc(e.target.value)} className="mb-1 bg-neutral-900 border-neutral-700 text-sm" />
        <Input placeholder="Impact (optional)" value={intImpact} onChange={(e) => setIntImpact(e.target.value)} className="mb-2 bg-neutral-900 border-neutral-700 text-sm" />
        <Button size="sm" variant="outline" onClick={addIntervention} disabled={saving || !intDesc.trim()}>
          <Plus className="w-3 h-3 mr-1" /> Add intervention
        </Button>
        {data?.interventions && data.interventions.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-neutral-400">
            {data.interventions.slice(-5).reverse().map((i) => (
              <li key={i.id}>[{i.category}] {i.description}{i.impact ? ` — ${i.impact}` : ""}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Outcome Scorecard */}
      <div>
        <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-1">
          <TrendingUp className="w-3 h-3" /> Outcome Scorecard
        </h4>
        <Input placeholder="Week start (YYYY-MM-DD)" value={outWeekStart} onChange={(e) => setOutWeekStart(e.target.value)} className="mb-1 bg-neutral-900 border-neutral-700 text-sm" />
        <Textarea
          placeholder="One per line: Metric: value unit (e.g. Time saved: 8 hrs)"
          value={outMetrics}
          onChange={(e) => setOutMetrics(e.target.value)}
          rows={2}
          className="bg-neutral-900 border-neutral-700 text-sm"
        />
        <Button size="sm" variant="outline" className="mt-1" onClick={addOutcomeEntry} disabled={saving || !outWeekStart.trim() || !outMetrics.trim()}>
          <Plus className="w-3 h-3 mr-1" /> Add weekly outcome
        </Button>
        {data?.outcomeEntries && data.outcomeEntries.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-neutral-400">
            {data.outcomeEntries.slice(0, 3).map((e) => (
              <li key={e.id}>Week {e.weekStart}: {e.metrics.map((m) => `${m.name}=${m.value}`).join(", ")}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Risk / Bottleneck */}
      <div>
        <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Risk / Bottleneck
        </h4>
        <div className="flex gap-2">
          <Input placeholder="What's blocking results now" value={riskDesc} onChange={(e) => setRiskDesc(e.target.value)} className="bg-neutral-900 border-neutral-700 text-sm" />
          <Button size="sm" variant="outline" onClick={addRisk} disabled={saving || !riskDesc.trim()}>Add</Button>
        </div>
        {data?.risks && data.risks.length > 0 && (
          <ul className="mt-2 space-y-1">
            {data.risks.map((r) => (
              <li key={r.id} className="flex items-center justify-between text-sm text-neutral-400 gap-2">
                <span>{r.description}</span>
                <Button size="sm" variant="ghost" className="text-xs h-6" onClick={() => resolveRisk(r.id)} disabled={saving}>
                  <Check className="w-3 h-3" /> Resolve
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Client Feedback */}
      <div>
        <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-1">
          <MessageSquare className="w-3 h-3" /> Client Feedback
        </h4>
        <Input placeholder="Check-in question" value={feedbackQuestion} onChange={(e) => setFeedbackQuestion(e.target.value)} className="mb-1 bg-neutral-900 border-neutral-700 text-sm" />
        <Textarea placeholder="Their response" value={feedbackResponse} onChange={(e) => setFeedbackResponse(e.target.value)} rows={2} className="bg-neutral-900 border-neutral-700 text-sm" />
        <Button size="sm" variant="outline" className="mt-1" onClick={addFeedback} disabled={saving || !feedbackResponse.trim()}>
          <Plus className="w-3 h-3 mr-1" /> Log feedback
        </Button>
        {data?.feedback && data.feedback.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-neutral-400">
            {data.feedback.slice(-3).reverse().map((f) => (
              <li key={f.id}>{f.response.slice(0, 80)}{f.response.length > 80 ? "…" : ""}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
