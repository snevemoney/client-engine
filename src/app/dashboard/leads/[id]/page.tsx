"use client";

import { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ExternalLink, Plus, FileText, X, Sparkles, Target, Send, Hammer, CheckCircle, XCircle, RefreshCw, AlertTriangle } from "lucide-react";
import { OpportunityBriefCard } from "@/components/dashboard/leads/OpportunityBriefCard";
import { RoiEstimateCard } from "@/components/dashboard/leads/RoiEstimateCard";
import { FollowUpSequenceCard } from "@/components/dashboard/leads/FollowUpSequenceCard";
import { ClientSuccessCard } from "@/components/dashboard/leads/ClientSuccessCard";
import { ClientResultsGlance } from "@/components/dashboard/leads/ClientResultsGlance";
import { ReusableAssetLogCard } from "@/components/dashboard/leads/ReusableAssetLogCard";
import { LeadCopilotCard } from "@/components/leads/LeadCopilotCard";
import { SalesProcessPanel } from "@/components/dashboard/leads/SalesProcessPanel";
import { SalesDriverCard } from "@/components/dashboard/leads/SalesDriverCard";
import { TrustToCloseChecklistPanel } from "@/components/proposals/TrustToCloseChecklistPanel";
import { parseLeadIntelligenceFromMeta } from "@/lib/lead-intelligence";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "sales", label: "Sales" },
  { key: "proposals", label: "Proposals" },
  { key: "intelligence", label: "Intelligence" },
  { key: "artifacts", label: "Artifacts" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

interface Artifact {
  id: string;
  type: string;
  title: string;
  content: string;
  createdAt: string;
  meta?: unknown;
}

interface Lead {
  id: string;
  title: string;
  source: string;
  sourceUrl: string | null;
  status: string;
  description: string | null;
  budget: string | null;
  timeline: string | null;
  platform: string | null;
  techStack: string[];
  contactName: string | null;
  contactEmail: string | null;
  score: number | null;
  scoreReason: string | null;
  tags: string[];
  proposalSentAt: string | null;
  approvedAt: string | null;
  buildStartedAt: string | null;
  buildCompletedAt: string | null;
  dealOutcome: string | null;
  createdAt: string;
  artifacts: Artifact[];
  salesStage: string | null;
  nextContactAt: string | null;
  lastContactAt: string | null;
  personalDetails: string | null;
  leadSourceType: string | null;
  leadSourceChannel: string | null;
  introducedBy: string | null;
  sourceDetail: string | null;
  referralAskStatus: string | null;
  referralAskAt: string | null;
  referralCount: number;
  relationshipStatus: string | null;
  relationshipLastCheck: string | null;
  touchCount: number;
  driverType?: string | null;
  driverReason?: string | null;
  desiredResult?: string | null;
  resultDeadline?: string | null;
  nextAction?: string | null;
  nextActionDueAt?: string | null;
  proofAngle?: string | null;
  scorePain?: number | null;
  scoreUrgency?: number | null;
  scoreBudget?: number | null;
  scoreResponsiveness?: number | null;
  scoreDecisionMaker?: number | null;
  scoreFit?: number | null;
  touches?: { id: string; type: string; direction: string; summary: string; scriptUsed: string | null; outcome: string | null; nextTouchAt: string | null; createdAt: string }[];
  referralsReceived?: { id: string; referredName: string; referredCompany: string | null; status: string; createdAt: string }[];
  meta?: unknown;
}

const STATUSES = ["NEW", "ENRICHED", "SCORED", "APPROVED", "REJECTED", "BUILDING", "SHIPPED"];
const SALES_STAGES = ["PROSPECTING", "APPROACH_CONTACT", "PRESENTATION", "FOLLOW_UP", "REFERRAL", "RELATIONSHIP_MAINTENANCE"] as const;
const ARTIFACT_TYPES = ["notes", "proposal", "scope", "screenshot", "case_study"];

const statusColors: Record<string, "default" | "success" | "warning" | "destructive"> = {
  NEW: "default", ENRICHED: "default", SCORED: "warning",
  APPROVED: "success", REJECTED: "destructive", BUILDING: "warning", SHIPPED: "success",
};

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [showArtifactForm, setShowArtifactForm] = useState(false);
  const [artifactType, setArtifactType] = useState("notes");
  const [artifactTitle, setArtifactTitle] = useState("");
  const [artifactContent, setArtifactContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedArtifact, setExpandedArtifact] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [building, setBuilding] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [revising, setRevising] = useState(false);
  const [reviseInstruction, setReviseInstruction] = useState("");
  const [markingSent, setMarkingSent] = useState(false);
  const [settingDeal, setSettingDeal] = useState(false);
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [aiError, setAiError] = useState<string | null>(null);

  const runAiAction = useCallback(async (
    action: () => Promise<void>,
    setLoading: (v: boolean) => void,
    label: string,
    retries = 1
  ) => {
    setAiError(null);
    setLoading(true);
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        await action();
        setLoading(false);
        return;
      } catch (e) {
        lastErr = e;
        if (attempt < retries) await new Promise((r) => setTimeout(r, 1500));
      }
    }
    setAiError(`${label} failed${lastErr instanceof Error ? `: ${lastErr.message}` : ". Try again."}`);
    setLoading(false);
  }, []);

  async function enrichLead() {
    const res = await fetch(`/api/enrich/${id}`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error ?? "Enrichment failed");
    }
    const full = await fetch(`/api/leads/${id}`);
    if (full.ok) setLead(await full.json());
  }

  async function scoreLead() {
    const res = await fetch(`/api/score/${id}`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error ?? "Scoring failed");
    }
    const updated = await res.json();
    setLead((prev) => prev ? { ...prev, ...updated } : prev);
  }

  async function startBuild() {
    const res = await fetch(`/api/build/${id}`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error ?? "Build failed");
    }
    const full = await fetch(`/api/leads/${id}`);
    if (full.ok) setLead(await full.json());
  }

  async function generateProposal() {
    const res = await fetch(`/api/propose/${id}`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error ?? "Proposal generation failed");
    }
    const full = await fetch(`/api/leads/${id}`);
    if (full.ok) setLead(await full.json());
  }

  const hasProposal = lead?.artifacts?.some((a) => a.type === "proposal") ?? false;
  const canApprove = hasProposal && lead?.status !== "APPROVED";

  async function approveLead() {
    if (!canApprove) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/leads/${id}/approve`, { method: "POST" });
      if (res.ok) {
        const full = await fetch(`/api/leads/${id}`);
        if (full.ok) setLead(await full.json());
      } else {
        const err = await res.json();
        alert(err.error ?? "Approve failed");
      }
    } catch (e) { alert("Approve failed"); }
    setApproving(false);
  }

  async function reviseProposal() {
    if (!reviseInstruction.trim()) return;
    setRevising(true);
    try {
      const res = await fetch(`/api/leads/${id}/proposal/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: reviseInstruction.trim() }),
      });
      if (res.ok) {
        const full = await fetch(`/api/leads/${id}`);
        if (full.ok) setLead(await full.json());
        setReviseInstruction("");
      } else {
        const err = await res.json();
        alert(err.error ?? "Revise failed");
      }
    } catch (e) {
      alert("Revise failed");
    }
    setRevising(false);
  }

  async function rejectLead() {
    setRejecting(true);
    try {
      const res = await fetch(`/api/leads/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: rejectNote.trim() || undefined }),
      });
      if (res.ok) {
        const full = await fetch(`/api/leads/${id}`);
        if (full.ok) setLead(await full.json());
        setShowRejectInput(false);
        setRejectNote("");
      } else {
        const err = await res.json();
        alert(err.error ?? "Reject failed");
      }
    } catch (e) { alert("Reject failed"); }
    setRejecting(false);
  }

  async function markProposalSent() {
    setMarkingSent(true);
    try {
      const res = await fetch(`/api/leads/${id}/proposal-sent`, { method: "POST" });
      if (res.ok) {
        const full = await fetch(`/api/leads/${id}`);
        if (full.ok) setLead(await full.json());
      }
    } catch (e) { alert("Failed"); }
    setMarkingSent(false);
  }

  async function setDealOutcome(outcome: "won" | "lost") {
    setSettingDeal(true);
    try {
      const res = await fetch(`/api/leads/${id}/deal-outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      });
      if (res.ok) {
        const full = await fetch(`/api/leads/${id}`);
        if (full.ok) setLead(await full.json());
      }
    } catch (e) { alert("Failed"); }
    setSettingDeal(false);
  }

  useEffect(() => {
    fetch(`/api/leads/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setLead(data);
        if (data?.artifacts) {
          const proposals = data.artifacts.filter((a: Artifact) => a.type === "proposal").sort((a: Artifact, b: Artifact) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setSelectedProposalId(proposals[0]?.id ?? null);
        }
        setLoading(false);
      });
  }, [id]);

  async function updateStatus(status: string) {
    const res = await fetch(`/api/leads/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setLead((prev) => (prev ? { ...prev, ...updated } : prev));
    } else {
      const err = await res.json().catch(() => null);
      alert(err?.error ?? `Failed to set status to ${status}`);
    }
  }

  async function updateField(field: string, value: string | null) {
    const res = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (res.ok) {
      const updated = await res.json();
      setLead((prev) => (prev ? { ...prev, ...updated } : prev));
    }
  }

  async function updateDateField(field: "nextContactAt" | "lastContactAt" | "relationshipLastCheck", value: string | null) {
    const res = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value ? (value.includes("T") ? value : `${value}T12:00:00.000Z`) : null }),
    });
    if (res.ok) {
      const updated = await res.json();
      setLead((prev) => (prev ? { ...prev, ...updated } : prev));
    }
  }

  function refetchLead() {
    fetch(`/api/leads/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setLead(d));
  }

  async function createArtifact() {
    if (!artifactTitle.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/leads/${id}/artifacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: artifactType, title: artifactTitle, content: artifactContent }),
    });
    if (res.ok) {
      const artifact = await res.json();
      setLead((prev) => prev ? { ...prev, artifacts: [artifact, ...prev.artifacts] } : prev);
      setArtifactTitle("");
      setArtifactContent("");
      setShowArtifactForm(false);
    }
    setSaving(false);
  }

  if (loading) return <div className="text-neutral-500 py-12 text-center">Loading...</div>;
  if (!lead) return <div className="text-neutral-500 py-12 text-center">Lead not found.</div>;

  const proposalCount = lead.artifacts.filter((a) => a.type === "proposal").length;
  const hasIntelligence = !!lead.artifacts.find((a) => a.type === "positioning" && a.title === "POSITIONING_BRIEF") ||
    !!lead.artifacts.find((a) => a.type === "notes" && a.title === "AI Enrichment Report") ||
    (lead.meta && typeof lead.meta === "object");

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/dashboard"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight truncate">{lead.title}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant={statusColors[lead.status]}>{lead.status}</Badge>
            <span className="text-sm text-neutral-500">via {lead.source}</span>
            {lead.sourceUrl && (
              <a href={lead.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-neutral-300">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            {lead.score != null && (
              <Badge variant={lead.score >= 70 ? "success" : lead.score >= 40 ? "warning" : "destructive"}>
                Score: {lead.score}
              </Badge>
            )}
            {lead.dealOutcome && (
              <Badge variant={lead.dealOutcome === "won" ? "success" : "destructive"} className="ml-1">
                {lead.dealOutcome}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* AI error banner */}
      {aiError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-900/50 bg-red-950/20 p-3 text-sm text-red-300">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{aiError}</span>
          <button onClick={() => setAiError(null)} className="text-red-400 hover:text-red-200"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* AI Actions — always visible */}
      <div className="flex gap-2 flex-wrap items-center">
        <Button variant="outline" size="sm" onClick={() => runAiAction(enrichLead, setEnriching, "Enrich")} disabled={enriching}>
          <Sparkles className="w-3.5 h-3.5" /> {enriching ? "Enriching..." : "Enrich"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => runAiAction(scoreLead, setScoring, "Score")} disabled={scoring}>
          <Target className="w-3.5 h-3.5" /> {scoring ? "Scoring..." : "Score"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => runAiAction(generateProposal, setProposing, "Proposal")} disabled={proposing}>
          <Send className="w-3.5 h-3.5" /> {proposing ? "Generating..." : "Propose"}
        </Button>
        {lead.status === "APPROVED" && (
          <Button variant="outline" size="sm" onClick={() => runAiAction(startBuild, setBuilding, "Build")} disabled={building}>
            <Hammer className="w-3.5 h-3.5" /> {building ? "Building..." : "Build"}
          </Button>
        )}
      </div>

      {/* Tab navigation */}
      <div className="border-b border-neutral-800 -mx-1">
        <nav className="flex gap-0 overflow-x-auto px-1" aria-label="Lead tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-neutral-100 text-neutral-100"
                  : "border-transparent text-neutral-500 hover:text-neutral-300 hover:border-neutral-700"
              }`}
            >
              {tab.label}
              {tab.key === "proposals" && proposalCount > 0 && (
                <span className="ml-1.5 text-xs text-neutral-500">({proposalCount})</span>
              )}
              {tab.key === "artifacts" && (
                <span className="ml-1.5 text-xs text-neutral-500">({lead.artifacts.length})</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === "overview" && (
        <>
          {(lead.status === "APPROVED" || lead.status === "BUILDING" || lead.status === "SHIPPED") && (
            <ClientResultsGlance leadId={id} />
          )}

          {(lead.status === "APPROVED" || lead.status === "BUILDING" || lead.status === "SHIPPED") && (
            <ReusableAssetLogCard leadId={id} />
          )}

          <div className="border border-neutral-800 rounded-lg p-4">
            <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">Pipeline Status</h3>
            <div className="flex gap-1.5 flex-wrap">
              {STATUSES.map((s) => (
                <Button key={s} variant={lead.status === s ? "default" : "outline"} size="sm" onClick={() => updateStatus(s)} className="text-xs">
                  {s}
                </Button>
              ))}
            </div>
          </div>

          <div className="border border-neutral-800 rounded-lg p-4">
            <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">Conversion</h3>
            <div className="grid gap-2 text-sm">
              {lead.proposalSentAt && <div className="text-neutral-400">Proposal sent: {new Date(lead.proposalSentAt).toLocaleString("en-US")}</div>}
              {lead.approvedAt && <div className="text-neutral-400">Approved: {new Date(lead.approvedAt).toLocaleString("en-US")}</div>}
              {lead.buildStartedAt && <div className="text-neutral-400">Build started: {new Date(lead.buildStartedAt).toLocaleString("en-US")}</div>}
              {lead.buildCompletedAt && <div className="text-neutral-400">Build completed: {new Date(lead.buildCompletedAt).toLocaleString("en-US")}</div>}
              {lead.dealOutcome && <div className="text-neutral-400">Deal: <span className={lead.dealOutcome === "won" ? "text-emerald-400" : "text-red-400"}>{lead.dealOutcome}</span></div>}
            </div>
            <div className="flex gap-2 flex-wrap mt-3">
              {!lead.proposalSentAt && hasProposal && (
                <Button variant="outline" size="sm" onClick={markProposalSent} disabled={markingSent}>{markingSent ? "..." : "Mark proposal sent"}</Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setDealOutcome("won")} disabled={settingDeal} className="text-emerald-400 border-emerald-800">Deal won</Button>
              <Button variant="outline" size="sm" onClick={() => setDealOutcome("lost")} disabled={settingDeal} className="text-red-400 border-red-900">Deal lost</Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <EditableField label="Budget" value={lead.budget} onSave={(v) => updateField("budget", v)} />
            <EditableField label="Timeline" value={lead.timeline} onSave={(v) => updateField("timeline", v)} />
            <EditableField label="Platform" value={lead.platform} onSave={(v) => updateField("platform", v)} />
            <EditableField label="Contact Name" value={lead.contactName} onSave={(v) => updateField("contactName", v)} />
            <EditableField label="Contact Email" value={lead.contactEmail} onSave={(v) => updateField("contactEmail", v)} />
            <div className="border border-neutral-800 rounded-lg p-3">
              <div className="text-xs text-neutral-500 mb-1">Tags</div>
              <div className="flex gap-1 flex-wrap">
                {lead.tags.length > 0 ? lead.tags.map((t) => (
                  <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                )) : <span className="text-sm text-neutral-600">—</span>}
              </div>
            </div>
          </div>

          {lead.description && (
            <div className="border border-neutral-800 rounded-lg p-4">
              <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Description</h3>
              <p className="text-sm text-neutral-200 whitespace-pre-wrap">{lead.description}</p>
            </div>
          )}

          {lead.scoreReason && (
            <div className="border border-neutral-800 rounded-lg p-4">
              <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Score Analysis</h3>
              <p className="text-sm text-neutral-200 whitespace-pre-wrap">{lead.scoreReason}</p>
            </div>
          )}
        </>
      )}

      {/* ── SALES TAB ── */}
      {activeTab === "sales" && (
        <>
          {lead.status !== "REJECTED" && lead.dealOutcome !== "won" && (
            <SalesDriverCard leadId={id} lead={lead} onUpdate={refetchLead} />
          )}

          <div className="border border-neutral-800 rounded-lg p-4">
            <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">Sales stage</h3>
            <div className="flex gap-2 flex-wrap items-center mb-3">
              <select
                value={lead.salesStage ?? ""}
                onChange={(e) => updateField("salesStage", e.target.value || "")}
                className="rounded-md border border-neutral-700 bg-neutral-900 text-sm text-neutral-200 px-3 py-1.5"
              >
                <option value="">—</option>
                {SALES_STAGES.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div>
                <label className="text-xs text-neutral-500 block mb-1">Next contact date</label>
                <input
                  type="date"
                  value={lead.nextContactAt ? lead.nextContactAt.slice(0, 10) : ""}
                  onChange={(e) => updateDateField("nextContactAt", e.target.value || null)}
                  className="rounded-md border border-neutral-700 bg-neutral-900 text-neutral-200 px-2 py-1.5 w-full"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500 block mb-1">Last contact date</label>
                <input
                  type="date"
                  value={lead.lastContactAt ? lead.lastContactAt.slice(0, 10) : ""}
                  onChange={(e) => updateDateField("lastContactAt", e.target.value || null)}
                  className="rounded-md border border-neutral-700 bg-neutral-900 text-neutral-200 px-2 py-1.5 w-full"
                />
              </div>
            </div>
            {(() => {
              const stage = lead.salesStage ?? (lead.proposalSentAt ? "FOLLOW_UP" : lead.status === "NEW" || lead.status === "ENRICHED" || lead.status === "SCORED" ? "PROSPECTING" : "APPROACH_CONTACT");
              const needsNextDate = ["APPROACH_CONTACT", "PRESENTATION", "FOLLOW_UP"].includes(stage) && lead.status !== "REJECTED" && lead.dealOutcome !== "won" && !lead.nextContactAt;
              if (!needsNextDate) return null;
              return (
                <p className="mt-3 text-sm text-red-400 font-medium">No next date = incomplete (leak). Set next contact date.</p>
              );
            })()}
          </div>

          <SalesProcessPanel
            leadId={id}
            leadSourceType={lead.leadSourceType ?? null}
            leadSourceChannel={lead.leadSourceChannel ?? null}
            sourceDetail={lead.sourceDetail ?? null}
            introducedBy={lead.introducedBy ?? null}
            referralAskStatus={lead.referralAskStatus ?? null}
            referralCount={lead.referralCount ?? 0}
            relationshipStatus={lead.relationshipStatus ?? null}
            relationshipLastCheck={lead.relationshipLastCheck ?? null}
            touchCount={lead.touchCount ?? 0}
            nextContactAt={lead.nextContactAt ?? null}
            lastContactAt={lead.lastContactAt ?? null}
            touches={lead.touches ?? []}
            referralsReceived={lead.referralsReceived ?? []}
            onUpdate={refetchLead}
            updateField={updateField}
            updateDateField={updateDateField}
          />

          <FollowUpSequenceCard
            leadId={id}
            proposalSentAt={lead.proposalSentAt}
            dealOutcome={lead.dealOutcome}
            onSequenceGenerated={() => fetch(`/api/leads/${id}`).then((r) => r.ok && r.json()).then((d) => d && setLead(d))}
          />
        </>
      )}

      {/* ── PROPOSALS TAB ── */}
      {activeTab === "proposals" && (
        <>
          {(lead.artifacts.some((a) => a.type === "notes") || lead.artifacts.some((a) => a.type === "proposal") || lead.artifacts.some((a) => a.type === "positioning")) && (
            <div className="border border-neutral-800 rounded-lg p-4">
              <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Pipeline artifacts</h3>
              <div className="flex gap-2 flex-wrap">
                {lead.artifacts.some((a) => a.type === "notes" && a.title === "AI Enrichment Report") && <Badge variant="outline">Enrichment</Badge>}
                {lead.score != null && <Badge variant="outline">Score</Badge>}
                {lead.artifacts.some((a) => a.type === "positioning" && a.title === "POSITIONING_BRIEF") && <Badge variant="outline">Positioning</Badge>}
                {hasProposal && <Badge variant="outline">Proposal</Badge>}
              </div>
            </div>
          )}

          <div id="proposal-review">
          {(() => {
            const positioning = lead.artifacts.find((a) => a.type === "positioning" && a.title === "POSITIONING_BRIEF");
            const proposals = lead.artifacts.filter((a) => a.type === "proposal").sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            const latestProposalId = proposals[0]?.id ?? null;
            const selectedProposal = proposals.find((p) => p.id === selectedProposalId) ?? proposals[0];
            const proposal = selectedProposal ?? null;
            if (!positioning && proposals.length === 0) return (
              <div className="border border-neutral-800 rounded-lg p-8 text-center text-sm text-neutral-500">
                No proposals yet. Use &quot;Propose&quot; above to generate one.
              </div>
            );
            return (
              <div className="border border-neutral-800 rounded-lg p-4">
                <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">Proposal review (positioning vs proposal)</h3>
                <div className="space-y-2 mb-4">
                  <div className="text-sm font-semibold">Proposal versions</div>
                  {proposals.length === 0 ? (
                    <div className="text-sm text-neutral-500">No proposals yet.</div>
                  ) : (
                    <div className="space-y-1">
                      {proposals.map((p, idx) => (
                        <div
                          key={p.id}
                          className={`rounded-md border p-2 transition-colors ${
                            p.id === selectedProposalId ? "bg-neutral-800 border-neutral-600" : "border-neutral-800"
                          }`}
                        >
                          <button
                            onClick={() => setSelectedProposalId(p.id)}
                            className="w-full text-left"
                          >
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-medium">Proposal v{proposals.length - idx}</div>
                              <div className="flex items-center gap-2">
                                {p.id === latestProposalId && (
                                  <span className="rounded bg-green-600 px-2 py-0.5 text-xs text-white">Latest</span>
                                )}
                                <span className="text-xs text-neutral-500">{new Date(p.createdAt).toLocaleString("en-US")}</span>
                              </div>
                            </div>
                            <div className="text-xs text-neutral-500 mt-0.5">{p.title ?? "PROPOSAL"}</div>
                          </button>
                          <Link
                            href={`/dashboard/proposals/${p.id}`}
                            className="text-xs text-emerald-400 hover:text-emerald-300 mt-2 inline-block"
                          >
                            Open Proposal Console →
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {positioning && proposal && (
                  <>
                <div className="flex gap-2 flex-wrap items-center mb-3">
                  <Input
                    placeholder="e.g. shorter, more aggressive, focus on ROI"
                    value={reviseInstruction}
                    onChange={(e) => setReviseInstruction(e.target.value)}
                    className="max-w-sm h-8 text-sm"
                    onKeyDown={(e) => e.key === "Enter" && reviseProposal()}
                  />
                  <Button variant="outline" size="sm" onClick={reviseProposal} disabled={revising || !reviseInstruction.trim()}>
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${revising ? "animate-spin" : ""}`} /> {revising ? "Revising..." : "Revise proposal"}
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="border border-neutral-700 rounded-md p-3 bg-neutral-900/40 max-h-[420px] overflow-y-auto">
                    <div className="text-xs font-medium text-neutral-400 mb-2">POSITIONING_BRIEF</div>
                    <pre className="text-sm text-neutral-300 whitespace-pre-wrap font-sans">{positioning.content}</pre>
                  </div>
                  <div className="border border-neutral-700 rounded-md p-3 bg-neutral-900/40 max-h-[420px] overflow-y-auto">
                    <div className="text-xs font-medium text-neutral-400 mb-2">Proposal</div>
                    <pre className="text-sm text-neutral-300 whitespace-pre-wrap font-sans">{proposal.content}</pre>
                  </div>
                </div>
                <div className="mt-4">
                  <TrustToCloseChecklistPanel
                    artifactId={proposal.id}
                    meta={proposal.meta}
                    onUpdate={() => refetchLead()}
                    compact
                  />
                </div>
                  </>
                )}
              </div>
            );
          })()}
          </div>

          {hasProposal && lead.status !== "APPROVED" && (
            <div className="border border-emerald-900/50 bg-emerald-950/20 rounded-lg p-4">
              <h3 className="text-xs font-medium text-emerald-400/90 uppercase tracking-wider mb-3">Approve proposal</h3>
              <div className="flex gap-3 flex-wrap items-center">
                <Button size="lg" onClick={approveLead} disabled={approving} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                  <CheckCircle className="w-4 h-4 mr-2" /> {approving ? "Approving..." : "Approve"}
                </Button>
                {!showRejectInput ? (
                  <Button variant="outline" size="sm" onClick={() => setShowRejectInput(true)} disabled={rejecting}>
                    <XCircle className="w-3.5 h-3.5 mr-1.5" /> Reject
                  </Button>
                ) : (
                  <div className="flex gap-2 flex-wrap items-center">
                    <Input
                      placeholder="Rejection note (optional)"
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      className="max-w-xs h-8 text-sm"
                    />
                    <Button variant="outline" size="sm" onClick={rejectLead} disabled={rejecting}>{rejecting ? "..." : "Submit"}</Button>
                    <Button variant="ghost" size="sm" onClick={() => { setShowRejectInput(false); setRejectNote(""); }}>Cancel</Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── INTELLIGENCE TAB ── */}
      {activeTab === "intelligence" && (
        <>
          {(() => {
            const positioningArtifact = lead.artifacts.find((a) => a.type === "positioning" && a.title === "POSITIONING_BRIEF");
            const enrichArtifact = lead.artifacts.find((a) => a.type === "notes" && a.title === "AI Enrichment Report");
            const li =
              parseLeadIntelligenceFromMeta(positioningArtifact?.meta) ||
              parseLeadIntelligenceFromMeta(enrichArtifact?.meta) ||
              (lead.meta && typeof lead.meta === "object" ? parseLeadIntelligenceFromMeta(lead.meta) : null);
            if (!li) return (
              <div className="border border-neutral-800 rounded-lg p-8 text-center text-sm text-neutral-500">
                No intelligence data yet. Enrich the lead first.
              </div>
            );
            const rev = li.reversibility;
            return (
              <div className="border border-neutral-800 rounded-lg p-4">
                <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">Lead intelligence</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <strong className="text-neutral-300">Adoption risk:</strong>{" "}
                    <span className="text-neutral-200">{li.adoptionRisk?.level ?? "unknown"}</span>
                    {(li.adoptionRisk as { confidence?: string })?.confidence && (
                      <span className="text-neutral-500 ml-1">({(li.adoptionRisk as { confidence: string }).confidence} confidence)</span>
                    )}
                  </div>
                  <div>
                    <strong className="text-neutral-300">Tool loyalty risk:</strong>{" "}
                    <span className="text-neutral-200">{li.toolLoyaltyRisk?.level ?? "unknown"}</span>
                    {(li.toolLoyaltyRisk as { confidence?: string })?.confidence && (
                      <span className="text-neutral-500 ml-1">({(li.toolLoyaltyRisk as { confidence: string }).confidence} confidence)</span>
                    )}
                  </div>
                  <div>
                    <strong className="text-neutral-300">Reversibility:</strong>{" "}
                    <span className="text-neutral-200">{(rev as { level?: string })?.level ?? rev?.strategy ?? "—"}</span>
                  </div>
                  {li.safeStartingPoint && (
                    <div>
                      <strong className="text-neutral-300">Safe starting point:</strong>{" "}
                      <span className="text-neutral-200">{li.safeStartingPoint}</span>
                    </div>
                  )}
                  {li.trustSensitivity && (
                    <div>
                      <strong className="text-neutral-300">Trust sensitivity:</strong>{" "}
                      <span className="text-neutral-200">{li.trustSensitivity}</span>
                    </div>
                  )}
                  <div>
                    <strong className="text-neutral-300">Stakeholders</strong>
                    <ul className="list-disc ml-5 mt-1 space-y-0.5 text-neutral-300">
                      {(li.stakeholderMap ?? []).map((s, i) => (
                        <li key={i}>
                          <span className="font-medium text-neutral-200">{s.role}</span>
                          {s.influence && <span className="text-neutral-500"> ({s.influence})</span>}
                          {s.stance && <span className="text-neutral-500"> {s.stance}</span>}
                          {": "}
                          {(s as { likelyConcern?: string }).likelyConcern ?? s.likelyObjection ?? "—"}
                          {(s as { whatMakesThemFeelSafe?: string }).whatMakesThemFeelSafe ? ` → ${(s as { whatMakesThemFeelSafe: string }).whatMakesThemFeelSafe}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })()}

          <LeadCopilotCard leadId={lead.id} />

          <OpportunityBriefCard leadId={id} />
          <RoiEstimateCard
            leadId={id}
            onRoiGenerated={() => fetch(`/api/leads/${id}`).then((r) => r.ok && r.json()).then((d) => d && setLead(d))}
          />

          {(lead.status === "APPROVED" || lead.status === "BUILDING" || lead.status === "SHIPPED") && (
            <div id="client-success">
              <ClientSuccessCard
                leadId={id}
                onProofGenerated={() => fetch(`/api/leads/${id}`).then((r) => r.ok && r.json()).then((d) => d && setLead(d))}
              />
            </div>
          )}
        </>
      )}

      {/* ── ARTIFACTS TAB ── */}
      {activeTab === "artifacts" && (
        <div className="border border-neutral-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
              Artifacts ({lead.artifacts.length})
            </h3>
            <Button size="sm" variant="outline" onClick={() => setShowArtifactForm(true)}>
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
          </div>

          {showArtifactForm && (
            <div className="border border-neutral-700 rounded-lg p-4 mb-4 space-y-3 bg-neutral-900/50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">New Artifact</span>
                <button onClick={() => setShowArtifactForm(false)} className="text-neutral-500 hover:text-neutral-300"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {ARTIFACT_TYPES.map((t) => (
                  <button key={t} onClick={() => setArtifactType(t)}
                    className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${artifactType === t ? "bg-neutral-700 border-neutral-600 text-neutral-100" : "border-neutral-800 text-neutral-400 hover:border-neutral-700"}`}
                  >{t}</button>
                ))}
              </div>
              <Input placeholder="Title" value={artifactTitle} onChange={(e) => setArtifactTitle(e.target.value)} />
              <Textarea placeholder="Content (markdown supported)" rows={6} value={artifactContent} onChange={(e) => setArtifactContent(e.target.value)} />
              <Button size="sm" onClick={createArtifact} disabled={saving || !artifactTitle.trim()}>
                {saving ? "Saving..." : "Save Artifact"}
              </Button>
            </div>
          )}

          {lead.artifacts.length === 0 && !showArtifactForm ? (
            <p className="text-sm text-neutral-500">No artifacts yet. Add notes, proposals, or scope documents.</p>
          ) : (
            <div className="space-y-2">
              {lead.artifacts.map((a) => (
                <div key={a.id} className="border border-neutral-800/50 rounded-md overflow-hidden">
                  <button
                    onClick={() => setExpandedArtifact(expandedArtifact === a.id ? null : a.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-neutral-800/30 transition-colors"
                  >
                    <FileText className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">{a.title}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] flex-shrink-0">{a.type}</Badge>
                    <span className="text-[10px] text-neutral-500 flex-shrink-0">
                      {new Date(a.createdAt).toLocaleDateString("en-US")}
                    </span>
                  </button>
                  {expandedArtifact === a.id && (
                    <div className="px-3 pb-3 border-t border-neutral-800/50">
                      <p className="text-sm text-neutral-300 whitespace-pre-wrap mt-2">{a.content}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EditableField({ label, value, onSave }: { label: string; value: string | null | undefined; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");

  function handleSave() {
    onSave(draft);
    setEditing(false);
  }

  return (
    <div className="border border-neutral-800 rounded-lg p-3">
      <div className="text-xs text-neutral-500 mb-1">{label}</div>
      {editing ? (
        <div className="flex gap-2">
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} className="h-7 text-sm" autoFocus onKeyDown={(e) => e.key === "Enter" && handleSave()} />
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleSave}>Save</Button>
        </div>
      ) : (
        <div className="text-sm text-neutral-200 cursor-pointer hover:text-white transition-colors" onClick={() => { setDraft(value || ""); setEditing(true); }}>
          {value || <span className="text-neutral-600">Click to edit</span>}
        </div>
      )}
    </div>
  );
}
