"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ExternalLink, Plus, FileText, X, Sparkles, Target, Send, Hammer, CheckCircle, XCircle } from "lucide-react";

interface Artifact {
  id: string;
  type: string;
  title: string;
  content: string;
  createdAt: string;
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
  createdAt: string;
  artifacts: Artifact[];
}

const STATUSES = ["NEW", "ENRICHED", "SCORED", "APPROVED", "REJECTED", "BUILDING", "SHIPPED"];
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

  async function enrichLead() {
    setEnriching(true);
    try {
      const res = await fetch(`/api/enrich/${id}`, { method: "POST" });
      if (res.ok) {
        const updated = await res.json();
        // Refetch full lead with artifacts
        const full = await fetch(`/api/leads/${id}`);
        if (full.ok) setLead(await full.json());
      } else {
        const err = await res.json();
        alert(`Enrichment failed: ${err.error}`);
      }
    } catch (e) { alert("Enrichment failed"); }
    setEnriching(false);
  }

  async function scoreLead() {
    setScoring(true);
    try {
      const res = await fetch(`/api/score/${id}`, { method: "POST" });
      if (res.ok) {
        const updated = await res.json();
        setLead((prev) => prev ? { ...prev, ...updated } : prev);
      } else {
        const err = await res.json();
        alert(`Scoring failed: ${err.error}`);
      }
    } catch (e) { alert("Scoring failed"); }
    setScoring(false);
  }

  async function startBuild() {
    setBuilding(true);
    try {
      const res = await fetch(`/api/build/${id}`, { method: "POST" });
      if (res.ok) {
        const full = await fetch(`/api/leads/${id}`);
        if (full.ok) setLead(await full.json());
      } else {
        const err = await res.json();
        alert(`Build failed: ${err.error}`);
      }
    } catch (e) { alert("Build factory failed"); }
    setBuilding(false);
  }

  async function generateProposal() {
    setProposing(true);
    try {
      const res = await fetch(`/api/propose/${id}`, { method: "POST" });
      if (res.ok) {
        const full = await fetch(`/api/leads/${id}`);
        if (full.ok) setLead(await full.json());
      } else {
        const err = await res.json();
        alert(`Proposal failed: ${err.error}`);
      }
    } catch (e) { alert("Proposal generation failed"); }
    setProposing(false);
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

  useEffect(() => {
    fetch(`/api/leads/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { setLead(data); setLoading(false); });
  }, [id]);

  async function updateStatus(status: string) {
    const res = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setLead((prev) => (prev ? { ...prev, ...updated } : prev));
    }
  }

  async function updateField(field: string, value: string) {
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
          </div>
        </div>
      </div>

      {/* Status bar */}
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

      {/* Latest pipeline artifacts summary */}
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

      {/* Proposal console: positioning + proposal side-by-side to spot drift */}
      {(() => {
        const positioning = lead.artifacts.find((a) => a.type === "positioning" && a.title === "POSITIONING_BRIEF");
        const proposal = lead.artifacts.find((a) => a.type === "proposal");
        if (!positioning || !proposal) return null;
        return (
          <div className="border border-neutral-800 rounded-lg p-4">
            <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">Proposal review (positioning vs proposal)</h3>
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
          </div>
        );
      })()}

      {/* Owner approval: one-click Approve when proposal exists */}
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

      {/* AI Actions */}
      <div className="flex gap-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={enrichLead} disabled={enriching}>
          <Sparkles className="w-3.5 h-3.5" /> {enriching ? "Enriching..." : "Enrich with AI"}
        </Button>
        <Button variant="outline" size="sm" onClick={scoreLead} disabled={scoring}>
          <Target className="w-3.5 h-3.5" /> {scoring ? "Scoring..." : "Score Lead"}
        </Button>
        <Button variant="outline" size="sm" onClick={generateProposal} disabled={proposing}>
          <Send className="w-3.5 h-3.5" /> {proposing ? "Generating..." : "Generate Proposal"}
        </Button>
        {(lead.status === "APPROVED" || lead.status === "SCORED") && (
          <Button variant="outline" size="sm" onClick={startBuild} disabled={building}>
            <Hammer className="w-3.5 h-3.5" /> {building ? "Building..." : "Start Build"}
          </Button>
        )}
      </div>

      {/* Two-column info */}
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

      {/* Description */}
      {lead.description && (
        <div className="border border-neutral-800 rounded-lg p-4">
          <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Description</h3>
          <p className="text-sm text-neutral-200 whitespace-pre-wrap">{lead.description}</p>
        </div>
      )}

      {/* Score reasoning */}
      {lead.scoreReason && (
        <div className="border border-neutral-800 rounded-lg p-4">
          <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Score Analysis</h3>
          <p className="text-sm text-neutral-200 whitespace-pre-wrap">{lead.scoreReason}</p>
        </div>
      )}

      {/* Artifacts */}
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
            <div className="flex gap-2">
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
                    {new Date(a.createdAt).toLocaleDateString()}
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
