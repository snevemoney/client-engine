"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Copy, Check, Loader2, ClipboardList } from "lucide-react";
import { fetchJsonThrow } from "@/lib/http/fetch-json";

type LeadOption = { id: string; title: string; itemType: "pipeline" | "intake" };

interface ProofArtifact {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  lead: { id: string; title: string };
}

interface ProofRecord {
  id: string;
  title: string;
  company: string | null;
  outcome: string;
  proofSnippet: string | null;
  beforeState: string | null;
  afterState: string | null;
  metricValue: string | null;
  metricLabel: string | null;
  intakeLeadId: string | null;
  proofCandidateId?: string | null;
  createdAt: string;
}

type ProofCandidateSummary = {
  createdThisWeek?: number;
  readyThisWeek?: number;
  promotedThisWeek?: number;
  pendingDrafts?: number;
  pendingReady?: number;
} | null;

function ProofRecordEditForm({
  record,
  onSave,
  onCancel,
}: {
  record: ProofRecord;
  onSave: (u: Partial<ProofRecord>) => Promise<void>;
  onCancel: () => void;
}) {
  const [proofSnippet, setProofSnippet] = useState(record.proofSnippet ?? "");
  const [beforeState, setBeforeState] = useState(record.beforeState ?? "");
  const [afterState, setAfterState] = useState(record.afterState ?? "");
  const [metricValue, setMetricValue] = useState(record.metricValue ?? "");
  const [metricLabel, setMetricLabel] = useState(record.metricLabel ?? "");
  const [saving, setSaving] = useState(false);

  return (
    <div className="mt-4 space-y-3">
      <div>
        <label className="block text-xs text-neutral-500 mb-1">Proof snippet</label>
        <Textarea
          value={proofSnippet}
          onChange={(e) => setProofSnippet(e.target.value)}
          rows={3}
          className="w-full bg-neutral-800 border-neutral-600 text-sm resize-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Before</label>
          <Input value={beforeState} onChange={(e) => setBeforeState(e.target.value)} className="bg-neutral-800 border-neutral-600" />
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">After</label>
          <Input value={afterState} onChange={(e) => setAfterState(e.target.value)} className="bg-neutral-800 border-neutral-600" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Metric value</label>
          <Input value={metricValue} onChange={(e) => setMetricValue(e.target.value)} className="bg-neutral-800 border-neutral-600" />
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Metric label</label>
          <Input value={metricLabel} onChange={(e) => setMetricLabel(e.target.value)} className="bg-neutral-800 border-neutral-600" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={saving} onClick={async () => {
          setSaving(true);
          await onSave({
            proofSnippet: proofSnippet.trim() || null,
            beforeState: beforeState.trim() || null,
            afterState: afterState.trim() || null,
            metricValue: metricValue.trim() || null,
            metricLabel: metricLabel.trim() || null,
          });
          setSaving(false);
        }}>Save</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

export default function ProofPage() {
  const searchParams = useSearchParams();
  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([]);
  const [proofPosts, setProofPosts] = useState<ProofArtifact[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<{ content: string; artifactId: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [proofRecords, setProofRecords] = useState<ProofRecord[]>([]);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [candidateSummary, setCandidateSummary] = useState<ProofCandidateSummary>(null);
  const didAutoGenerate = useRef(false);

  const fetchCandidateSummary = useCallback(async (signal?: AbortSignal) => {
    try {
      const d = await fetchJsonThrow<ProofCandidateSummary>("/api/proof-candidates/summary", { signal });
      setCandidateSummary(d && typeof d === "object" ? d : null);
    } catch {
      setCandidateSummary(null);
    }
  }, []);

  const fetchProofRecords = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await fetchJsonThrow<ProofRecord[]>("/api/proof-records", { signal });
      setProofRecords(Array.isArray(data) ? data : []);
    } catch {
      // non-critical: keep existing records on error
    }
  }, []);

  const fetchLeadOptions = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await fetchJsonThrow<{ pipeline?: { id: string; title: string }[]; intake?: { id: string; title: string }[] }>("/api/proof/lead-options", { signal });
      const combined: LeadOption[] = [
        ...(data.pipeline ?? []).map((l) => ({ ...l, itemType: "pipeline" as const })),
        ...(data.intake ?? []).map((l) => ({ ...l, itemType: "intake" as const })),
      ];
      setLeadOptions(combined);
      setSelectedLeadId((prev) => (prev ? prev : combined.length ? `${combined[0].itemType}:${combined[0].id}` : ""));
    } catch {
      // non-critical: keep existing options on error
    }
  }, []);

  const fetchProofPosts = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await fetchJsonThrow<ProofArtifact[]>("/api/proof", { signal });
      setProofPosts(Array.isArray(data) ? data : []);
    } catch {
      // non-critical: keep existing posts on error
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchLeadOptions(controller.signal);
    fetchProofPosts(controller.signal);
    fetchProofRecords(controller.signal);
    fetchCandidateSummary(controller.signal);
    return () => controller.abort();
  }, [fetchLeadOptions, fetchProofPosts, fetchProofRecords, fetchCandidateSummary]);

  // URL trigger for browser automation: ?generate=1 runs generate once when a lead is selected
  useEffect(() => {
    if (didAutoGenerate.current || !searchParams.get("generate") || !selectedLeadId) return;
    const parsed = selectedLeadId.startsWith("intake:")
      ? { type: "intake" as const, id: selectedLeadId.slice(7) }
      : selectedLeadId.startsWith("pipeline:")
        ? { type: "pipeline" as const, id: selectedLeadId.slice(9) }
        : { type: "pipeline" as const, id: selectedLeadId };
    didAutoGenerate.current = true;
    (async () => {
      const { type, id } = parsed;
      setGenerating(true);
      setLastGenerated(null);
      try {
        const body = type === "intake" ? { intakeLeadId: id } : { leadId: id };
        const data = await fetchJsonThrow<{ content: string; artifactId: string }>("/api/proof/generate", {
          method: "POST",
          body: JSON.stringify(body),
        });
        setLastGenerated({ content: data.content, artifactId: data.artifactId });
        if (type === "pipeline") fetchProofPosts();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Generate failed");
      } finally {
        setGenerating(false);
      }
    })();
  }, [selectedLeadId, searchParams, fetchProofPosts]);

  function parseSelected(): { type: "pipeline" | "intake"; id: string } | null {
    if (!selectedLeadId) return null;
    if (selectedLeadId.startsWith("intake:")) return { type: "intake", id: selectedLeadId.slice(7) };
    if (selectedLeadId.startsWith("pipeline:")) return { type: "pipeline", id: selectedLeadId.slice(9) };
    return { type: "pipeline", id: selectedLeadId }; // legacy: plain id = pipeline
  }

  async function generate() {
    const parsed = parseSelected();
    if (!parsed) return;
    const { type, id } = parsed;
    setGenerating(true);
    setLastGenerated(null);
    try {
      const body = type === "intake" ? { intakeLeadId: id } : { leadId: id };
      const data = await fetchJsonThrow<{ content: string; artifactId: string }>("/api/proof/generate", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setLastGenerated({ content: data.content, artifactId: data.artifactId });
      if (type === "pipeline") fetchProofPosts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generate failed");
    } finally {
      setGenerating(false);
    }
  }

  async function copyContent(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }

  const displayContent = lastGenerated?.content ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Quiet Proof</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Generate daily proof posts from real pipeline artifacts. No hype, no invented numbers.
        </p>
      </div>

      <section className="border border-neutral-800 rounded-lg p-6">
        <h2 className="text-sm font-medium text-neutral-300 mb-4 flex items-center gap-2">
          <ClipboardList className="w-4 h-4" />
          Proof candidates
        </h2>
        <div className="flex flex-wrap gap-4 text-sm">
          <span><strong>{candidateSummary?.pendingDrafts ?? 0}</strong> drafts</span>
          <span><strong>{candidateSummary?.pendingReady ?? 0}</strong> ready</span>
          <span className="text-emerald-400"><strong>{candidateSummary?.promotedThisWeek ?? 0}</strong> promoted this week</span>
        </div>
        <Link href="/dashboard/proof-candidates" className="inline-block mt-3">
          <Button variant="outline" size="sm">Open Proof Candidates</Button>
        </Link>
      </section>

      <section className="border border-neutral-800 rounded-lg p-6">
        <h2 className="text-sm font-medium text-neutral-300 mb-4">Generate proof post</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[200px]">
            <label className="block text-xs text-neutral-500 mb-1">Lead (pipeline or intake)</label>
            <select
              value={selectedLeadId}
              onChange={(e) => setSelectedLeadId(e.target.value)}
              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            >
              <option value="">Select a lead</option>
              {leadOptions.map((l) => {
                const val = `${l.itemType}:${l.id}`;
                const label = l.itemType === "intake" ? `[Intake] ${l.title}` : l.title;
                return (
                  <option key={val} value={val}>
                    {label.slice(0, 60)}{label.length > 60 ? "…" : ""}
                  </option>
                );
              })}
            </select>
          </div>
          <Button
            data-testid="proof-generate-btn"
            onClick={generate}
            disabled={generating || !selectedLeadId}
            className="gap-2"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Generate
          </Button>
        </div>
        {displayContent && (
          <div className="mt-4 p-4 rounded-lg bg-neutral-900/50 border border-neutral-800">
            <pre className="text-sm text-neutral-300 whitespace-pre-wrap font-sans">{displayContent}</pre>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 gap-2"
              onClick={() => copyContent(displayContent)}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        )}
      </section>

      {proofRecords.length > 0 && (
        <section className="border border-neutral-800 rounded-lg overflow-hidden">
          <h2 className="text-sm font-medium text-neutral-300 px-6 py-3 border-b border-neutral-800">Proof records (from intake)</h2>
          <ul className="divide-y divide-neutral-800">
            {proofRecords.map((r) => (
              <li key={r.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-neutral-200">{r.title}</div>
                    {r.company && <div className="text-xs text-neutral-500">{r.company}</div>}
                    <div className="text-xs text-neutral-500 mt-1">
                      {new Date(r.createdAt).toLocaleString("en-US")}
                      {r.intakeLeadId && (
                        <Link href={`/dashboard/intake/${r.intakeLeadId}`} className="ml-2 text-blue-400 hover:underline">
                          View intake
                        </Link>
                      )}
                      {r.proofCandidateId && (
                        <Link href={`/dashboard/proof-candidates/${r.proofCandidateId}`} className="ml-2 text-neutral-400 hover:underline">
                          (from candidate)
                        </Link>
                      )}
                    </div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">{r.outcome}</span>
                </div>
                {editingRecordId === r.id ? (
                  <ProofRecordEditForm
                    record={r}
                    onSave={async (updates) => {
                      try {
                        await fetchJsonThrow(`/api/proof-records/${r.id}`, {
                          method: "PATCH",
                          body: JSON.stringify(updates),
                        });
                        toast.success("Saved");
                        setEditingRecordId(null);
                        fetchProofRecords();
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Save failed");
                      }
                    }}
                    onCancel={() => setEditingRecordId(null)}
                  />
                ) : (
                  <>
                    {r.proofSnippet && <pre className="mt-2 text-xs text-neutral-400 whitespace-pre-wrap font-sans">{r.proofSnippet}</pre>}
                    <Button variant="ghost" size="sm" className="mt-2" onClick={() => setEditingRecordId(r.id)}>Edit</Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {proofPosts.length > 0 && (
        <section className="border border-neutral-800 rounded-lg overflow-hidden">
          <h2 className="text-sm font-medium text-neutral-300 px-6 py-3 border-b border-neutral-800">Recent proof posts</h2>
          <ul className="divide-y divide-neutral-800">
            {proofPosts.slice(0, 15).map((a) => (
              <li key={a.id} className="px-6 py-3 hover:bg-neutral-900/30">
                <Link href={`/dashboard/leads/${a.lead.id}`} className="block">
                  <div className="text-sm text-neutral-200">{a.lead.title}</div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    {new Date(a.createdAt).toLocaleString("en-US")}
                  </div>
                </Link>
                <pre className="mt-2 text-xs text-neutral-400 whitespace-pre-wrap font-sans line-clamp-3">{a.content}</pre>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 gap-1 text-neutral-400"
                  onClick={(e) => {
                    e.preventDefault();
                    copyContent(a.content);
                  }}
                >
                  <Copy className="w-3 h-3" /> Copy
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
