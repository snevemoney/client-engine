"use client";

import { use, useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeliveryHandoffRetention } from "@/components/delivery/DeliveryHandoffRetention";
import { DeliveryChecklist } from "@/components/delivery/DeliveryChecklist";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { fetchJsonThrow } from "@/lib/http/fetch-json";
import { Loader2, Sparkles } from "lucide-react";
import { useBrainPanel } from "@/contexts/BrainPanelContext";

type Project = {
  id: string;
  status: string;
  title: string;
  clientName: string | null;
  company: string | null;
  summary: string | null;
  owner: string | null;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  deliveryNotes: string | null;
  qaNotes: string | null;
  handoffNotes: string | null;
  githubUrl: string | null;
  loomUrl: string | null;
  proofRequestedAt: string | null;
  proofCandidateId: string | null;
  pipelineLeadId?: string | null;
  proposal?: { id: string; title: string; status: string } | null;
  health: string;
  milestones: { id: string; title: string; status: string }[];
  checklistItems: { id: string; category: string; label: string; isDone: boolean; isRequired: boolean }[];
  readiness: { canComplete: boolean; reasons: string[] };
  handoffStartedAt?: string | null;
  handoffCompletedAt?: string | null;
  handoffOwner?: string | null;
  handoffSummary?: string | null;
  clientConfirmedAt?: string | null;
  testimonialRequestedAt?: string | null;
  testimonialReceivedAt?: string | null;
  testimonialStatus?: string;
  testimonialQuote?: string | null;
  testimonialSourceUrl?: string | null;
  reviewRequestedAt?: string | null;
  reviewReceivedAt?: string | null;
  reviewPlatform?: string | null;
  reviewUrl?: string | null;
  referralRequestedAt?: string | null;
  referralReceivedAt?: string | null;
  referralStatus?: string;
  referralNotes?: string | null;
  retentionStatus?: string;
  retentionNextFollowUpAt?: string | null;
  retentionLastContactedAt?: string | null;
  retentionFollowUpCount?: number;
  retentionOutcome?: string | null;
  upsellOpportunity?: string | null;
  upsellValueEstimate?: number | null;
  postDeliveryHealth?: string;
  builderSiteId?: string | null;
  builderPreviewUrl?: string | null;
  builderLiveUrl?: string | null;
  builderPreset?: string | null;
  activities?: {
    id: string;
    type: string;
    message: string | null;
    metaJson: Record<string, unknown> | null;
    createdAt: string;
  }[];
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

export default function DeliveryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { confirm, dialogProps } = useConfirmDialog();
  const { open: openBrain } = useBrainPanel();
  const toastFn = (m: string, t?: "success" | "error") => t === "error" ? toast.error(m) : toast.success(m);

  const refetch = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJsonThrow<Project>(`/api/delivery-projects/${id}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setProject(data);
    } catch (e) {
      if (controller.signal.aborted) return;
      if (e instanceof Error && (e.name === "AbortError" || e.message?.includes("aborted"))) return;
      setError(e instanceof Error ? e.message : "Failed to load");
      setProject(null);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }, [id]);

  useEffect(() => {
    void refetch();
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [refetch]);

  if (loading) return <div className="py-12 text-neutral-500">Loading…</div>;
  if (error || !project) return (
    <div>
      <p className="text-neutral-500">{error ?? "Project not found."}</p>
      <Link href="/dashboard/delivery" className="text-emerald-400 hover:underline mt-2 inline-block">← Delivery</Link>
    </div>
  );

  const handleComplete = async () => {
    if (!(await confirm({ title: "Mark project completed?", body: "This will mark the delivery project as completed.", confirmLabel: "Complete" }))) return;
    try {
      await fetchJsonThrow(`/api/delivery-projects/${id}/complete`, { method: "POST", body: "{}" });
      toast.success("Project completed");
      void refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cannot complete");
    }
  };

  const handleCreateProof = async () => {
    if (!(await confirm({ title: "Create proof candidate?", body: "This will create a new proof candidate from this project.", confirmLabel: "Create" }))) return;
    try {
      await fetchJsonThrow(`/api/delivery-projects/${id}/create-proof-candidate`, { method: "POST" });
      toast.success("Proof candidate created");
      void refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create proof candidate");
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/dashboard/delivery" className="text-sm text-neutral-400 hover:text-neutral-200">← Delivery</Link>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{project.title}</h1>
            <Badge variant="outline" className="capitalize">{project.status.replace(/_/g, " ")}</Badge>
            <Badge variant="outline" className={project.health === "overdue" ? "text-red-400" : project.health === "due_soon" ? "text-amber-400" : ""}>
              {project.health.replace(/_/g, " ")}
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={openBrain}
            className="gap-1.5 border-amber-700 text-amber-400 hover:bg-amber-900/30 shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Ask AI
          </Button>
        </div>
        <div className="flex items-center gap-4 mt-1 text-sm">
          <span className="text-neutral-400">{project.clientName ?? project.company ?? "—"}</span>
          <span className="text-neutral-500">Due: {formatDate(project.dueDate)}</span>
          {project.pipelineLeadId && (
            <Link href={`/dashboard/leads/${project.pipelineLeadId}`} className="text-emerald-400 hover:underline text-xs">Lead</Link>
          )}
          {project.proposal && (
            <Link href={`/dashboard/proposals/${project.proposal.id}`} className="text-emerald-400 hover:underline text-xs">Proposal</Link>
          )}
          {project.githubUrl && (
            <a href={project.githubUrl} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline text-xs">GitHub</a>
          )}
          {project.loomUrl && (
            <a href={project.loomUrl} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline text-xs">Loom</a>
          )}
        </div>
      </div>

      {/* Customer Feedback & Retention — top priority */}
      <DeliveryHandoffRetention
        project={{
          id: project.id,
          status: project.status,
          handoffStartedAt: project.handoffStartedAt ?? null,
          handoffCompletedAt: project.handoffCompletedAt ?? null,
          handoffOwner: project.handoffOwner ?? null,
          handoffSummary: project.handoffSummary ?? null,
          clientConfirmedAt: project.clientConfirmedAt ?? null,
          testimonialRequestedAt: project.testimonialRequestedAt ?? null,
          testimonialReceivedAt: project.testimonialReceivedAt ?? null,
          testimonialStatus: project.testimonialStatus ?? "none",
          testimonialQuote: project.testimonialQuote ?? null,
          testimonialSourceUrl: project.testimonialSourceUrl ?? null,
          reviewRequestedAt: project.reviewRequestedAt ?? null,
          reviewReceivedAt: project.reviewReceivedAt ?? null,
          reviewPlatform: project.reviewPlatform ?? null,
          reviewUrl: project.reviewUrl ?? null,
          referralRequestedAt: project.referralRequestedAt ?? null,
          referralReceivedAt: project.referralReceivedAt ?? null,
          referralStatus: project.referralStatus ?? "none",
          referralNotes: project.referralNotes ?? null,
          retentionStatus: project.retentionStatus ?? "none",
          retentionNextFollowUpAt: project.retentionNextFollowUpAt ?? null,
          retentionLastContactedAt: project.retentionLastContactedAt ?? null,
          retentionFollowUpCount: project.retentionFollowUpCount ?? 0,
          retentionOutcome: project.retentionOutcome ?? null,
          upsellOpportunity: project.upsellOpportunity ?? null,
          upsellValueEstimate: project.upsellValueEstimate ?? null,
          postDeliveryHealth: project.postDeliveryHealth ?? "green",
        }}
        onReload={() => void refetch()}
      />

      {/* Progress */}
      <MilestonesSection projectId={id} milestones={project.milestones} onUpdate={refetch} />

      <DeliveryChecklist
        projectId={project.id}
        items={project.checklistItems}
        onUpdate={(updated) =>
          setProject((p) =>
            p ? { ...p, checklistItems: updated } : null
          )
        }
      />

      {!project.completedAt && (
        <div className="flex flex-wrap gap-2">
          {project.readiness?.canComplete ? (
            <Button onClick={handleComplete}>Mark completed</Button>
          ) : (
            <p className="text-sm text-amber-400">{project.readiness?.reasons?.join("; ") ?? "Complete checklist to mark done"}</p>
          )}
          <Button variant="outline" onClick={handleCreateProof} disabled={!!project.proofCandidateId}>
            {project.proofCandidateId ? "Proof linked" : "Create proof candidate"}
          </Button>
        </div>
      )}

      {project.summary && (
        <div>
          <h2 className="text-sm font-medium text-neutral-500 mb-1">Summary</h2>
          <p className="text-neutral-300">{project.summary}</p>
        </div>
      )}

      {/* Website Builder */}
      {project.builderSiteId && (
        <BuilderSection project={project} projectId={id} onReload={() => void refetch()} />
      )}

      {/* Flywheel Action Log */}
      <FlywheelLog activities={project.activities ?? []} />

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Flywheel Action Log
// ---------------------------------------------------------------------------

type FlywheelStepData = {
  step: string;
  status: "ok" | "skipped" | "error";
  detail: string;
  reasoning: string;
  entityId?: string;
  durationMs: number;
};

const STEP_LABELS: Record<string, string> = {
  create_lead: "Create Lead",
  pipeline: "AI Qualification Pipeline",
  create_proposal: "Generate Proposal",
  send_proposal: "Send Proposal",
  accept_and_create_project: "Accept & Create Project",
  trigger_builder: "Website Builder",
  post_hooks: "System Cascade",
  complete: "Complete",
  fatal: "Fatal Error",
};

const STEP_ICONS: Record<string, string> = {
  ok: "\u2713",
  error: "\u2717",
  skipped: "\u2014",
};

function FlywheelLog({ activities }: { activities: { id: string; type: string; message: string | null; metaJson: Record<string, unknown> | null; createdAt: string }[] }) {
  const logActivity = activities.find(
    (a) => a.metaJson && (a.metaJson as Record<string, unknown>).action === "flywheel_log",
  );

  if (!logActivity?.metaJson) return null;

  const meta = logActivity.metaJson as {
    steps: FlywheelStepData[];
    totalDurationMs: number;
    input: { title: string; source?: string; preset?: string; contactName?: string; company?: string };
  };
  const steps = meta.steps ?? [];
  const [expanded, setExpanded] = useState<string | null>(null);

  if (steps.length === 0) return null;

  const okCount = steps.filter((s) => s.status === "ok").length;
  const errCount = steps.filter((s) => s.status === "error").length;

  return (
    <div className="rounded-lg border border-neutral-800 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-neutral-400">Agent Action Log</h2>
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <span>{okCount} passed</span>
          {errCount > 0 && <span className="text-red-400">{errCount} failed</span>}
          <span>{(meta.totalDurationMs / 1000).toFixed(1)}s</span>
        </div>
      </div>

      <div className="space-y-1">
        {steps.filter((s) => s.step !== "complete").map((step) => {
          const isExpanded = expanded === step.step;
          return (
            <div key={step.step} className="text-sm">
              <button
                onClick={() => setExpanded(isExpanded ? null : step.step)}
                className="w-full flex items-center gap-2 py-1.5 px-2 rounded hover:bg-neutral-800/50 text-left"
              >
                <span className={step.status === "ok" ? "text-emerald-400" : step.status === "error" ? "text-red-400" : "text-neutral-500"}>
                  {STEP_ICONS[step.status] ?? "-"}
                </span>
                <span className="flex-1 text-neutral-300">{STEP_LABELS[step.step] ?? step.step}</span>
                <span className="text-neutral-600 text-xs">{(step.durationMs / 1000).toFixed(1)}s</span>
                <span className="text-neutral-600 text-xs">{isExpanded ? "\u25B2" : "\u25BC"}</span>
              </button>

              {isExpanded && (
                <div className="ml-7 pl-2 border-l border-neutral-800 pb-2 space-y-1">
                  <p className="text-neutral-400 text-xs">{step.detail}</p>
                  {step.reasoning && (
                    <p className="text-neutral-500 text-xs italic">{step.reasoning}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {meta.input && (
        <div className="text-xs text-neutral-600 pt-1 border-t border-neutral-800">
          Input: {meta.input.title}
          {meta.input.source ? ` via ${meta.input.source}` : ""}
          {meta.input.preset ? ` (${meta.input.preset.replace(/_/g, " ")})` : ""}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Builder Section
// ---------------------------------------------------------------------------

type SectionEntry = { type: string; props: Record<string, unknown> };
type SiteFeedback = {
  health: { score: number; label: string; sectionCount: number; issueCount: number };
  sectionScores: { type: string; score: number; issues: string[] }[];
  missingSections: { type: string; reason: string; defaultProps: Record<string, unknown> }[];
  suggestions: string[];
};

const SECTION_LABELS: Record<string, string> = {
  hero: "Hero", about: "About", services: "Services", testimonials: "Testimonials",
  booking: "Booking", contact: "Contact", footer: "Footer",
};

type SupportRequest = {
  id: string;
  subject: string;
  message: string;
  status: string;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

function BuilderSection({
  project,
  projectId,
  onReload,
}: {
  project: Project;
  projectId: string;
  onReload: () => void;
}) {
  const [deploying, setDeploying] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [sections, setSections] = useState<SectionEntry[]>([]);
  const [feedback, setFeedback] = useState<SiteFeedback | null>(null);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [loadingSections, setLoadingSections] = useState(false);
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const siteId = project.builderSiteId;
  const builderApi = (path: string, opts?: RequestInit & { timeoutMs?: number }) =>
    fetchJsonThrow(`/api/delivery-projects/${projectId}/builder${path}`, opts as Parameters<typeof fetchJsonThrow>[1]);

  // Load support requests
  useEffect(() => {
    if (!siteId) return;
    fetchJsonThrow<SupportRequest[]>(`/api/delivery-projects/${projectId}/builder/support`)
      .then(setSupportRequests)
      .catch(() => {}); // silent — not critical
  }, [siteId, projectId]);

  // Load sections + feedback when editor is opened
  useEffect(() => {
    if (!showEditor || !siteId) return;
    setLoadingSections(true);
    Promise.all([
      fetchJsonThrow<{ sections: SectionEntry[] }>(`/api/delivery-projects/${projectId}/builder/sections`),
      fetchJsonThrow<SiteFeedback>(`/api/delivery-projects/${projectId}/builder/feedback`),
    ])
      .then(([siteData, fb]) => {
        setSections(siteData.sections);
        setFeedback(fb);
      })
      .catch(() => toast.error("Failed to load site data"))
      .finally(() => setLoadingSections(false));
  }, [showEditor, siteId, projectId]);

  const handleDeploy = async () => {
    setDeploying(true);
    try {
      await fetchJsonThrow(`/api/delivery-projects/${projectId}/builder/deploy`, { method: "POST", body: "{}" });
      toast.success("Site deployed!");
      onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Deploy failed");
    } finally {
      setDeploying(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetchJsonThrow(`/api/delivery-projects/${projectId}/builder/sections`, {
        method: "PATCH",
        body: JSON.stringify({ sections }),
      });
      toast.success("Sections saved");
      // Refresh iframe
      if (iframeRef.current) iframeRef.current.src = iframeRef.current.src;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await fetchJsonThrow(`/api/delivery-projects/${projectId}/builder/regenerate`, { method: "POST", body: "{}" });
      toast.success("Content regenerated — refreshing preview");
      // Reload sections + preview
      if (iframeRef.current) setTimeout(() => { if (iframeRef.current) iframeRef.current.src = iframeRef.current.src; }, 1000);
      setShowEditor(false);
      setTimeout(() => setShowEditor(true), 100);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Regeneration failed");
    } finally {
      setRegenerating(false);
    }
  };

  const updateSectionProp = (idx: number, key: string, value: unknown) => {
    setSections((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, props: { ...s.props, [key]: value } } : s))
    );
  };

  const addSection = (type: string, defaultProps: Record<string, unknown>) => {
    setSections((prev) => [...prev.filter((s) => s.type !== "footer"), { type, props: defaultProps }, ...prev.filter((s) => s.type === "footer")]);
  };

  return (
    <div className="rounded-lg border border-neutral-800 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-neutral-400">Website Builder</h2>
          {supportRequests.filter((r) => r.status !== "resolved").length > 0 && (
            <span className="text-[10px] font-medium bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">
              {supportRequests.filter((r) => r.status !== "resolved").length} help {supportRequests.filter((r) => r.status !== "resolved").length === 1 ? "request" : "requests"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {project.builderPreset && (
            <Badge variant="outline" className="text-xs capitalize">{project.builderPreset.replace(/_/g, " ")}</Badge>
          )}
          {project.builderPreviewUrl && (
            <button onClick={() => setShowPreview((v) => !v)} className="text-xs text-neutral-500 hover:text-neutral-300">
              {showPreview ? "Hide preview" : "Show preview"}
            </button>
          )}
          <button onClick={() => setShowEditor((v) => !v)} className="text-xs text-amber-400 hover:text-amber-300">
            {showEditor ? "Close editor" : "Edit sections"}
          </button>
        </div>
      </div>

      {/* Iframe preview */}
      {showPreview && project.builderPreviewUrl && (
        <div className="rounded-lg overflow-hidden border border-neutral-700 bg-white">
          <iframe
            ref={iframeRef}
            src={project.builderPreviewUrl}
            title="Site preview"
            className="w-full h-[500px]"
          />
        </div>
      )}

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {project.builderPreviewUrl && (
          <a href={project.builderPreviewUrl} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">Open preview</a>
        )}
        {project.builderLiveUrl && (
          <a href={project.builderLiveUrl} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">Live site</a>
        )}
        {!project.builderLiveUrl && (
          <Button size="sm" variant="outline" onClick={handleDeploy} disabled={deploying}>
            {deploying ? "Deploying…" : "Deploy to production"}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={handleRegenerate} disabled={regenerating}>
          {regenerating ? "Regenerating…" : "Regenerate content"}
        </Button>
      </div>

      {/* Feedback panel */}
      {feedback && (
        <div className="border border-neutral-800 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">Website Health</span>
            <Badge variant="outline" className={`text-xs ${feedback.health.label === "great" ? "text-emerald-400" : feedback.health.label === "needs_work" ? "text-amber-400" : "text-red-400"}`}>
              {feedback.health.score}% — {feedback.health.label.replace(/_/g, " ")}
            </Badge>
          </div>
          {feedback.suggestions.length > 0 && (
            <ul className="text-xs text-neutral-500 space-y-1">
              {feedback.suggestions.map((s, i) => <li key={i}>• {s}</li>)}
            </ul>
          )}
          {feedback.missingSections.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs text-neutral-500">Missing sections:</span>
              <div className="flex gap-2 flex-wrap">
                {feedback.missingSections.map((ms) => (
                  <button
                    key={ms.type}
                    onClick={() => addSection(ms.type, ms.defaultProps)}
                    className="text-xs px-2 py-1 rounded border border-neutral-700 text-amber-400 hover:bg-neutral-800"
                    title={ms.reason}
                  >
                    + {SECTION_LABELS[ms.type] ?? ms.type}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Section editor */}
      {showEditor && (
        <div className="space-y-3">
          {loadingSections ? (
            <p className="text-xs text-neutral-500">Loading sections…</p>
          ) : (
            <>
              {sections.map((section, idx) => (
                <div key={idx} className="border border-neutral-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-neutral-300">{SECTION_LABELS[section.type] ?? section.type}</span>
                    {feedback?.sectionScores.find((s) => s.type === section.type) && (
                      <span className="text-xs text-neutral-500">
                        {feedback.sectionScores.find((s) => s.type === section.type)!.score}%
                      </span>
                    )}
                  </div>
                  {/* Render editable fields based on section type */}
                  {renderSectionFields(section, idx, updateSectionProp)}
                </div>
              ))}
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Support requests from client */}
      <SupportRequestsSection
        requests={supportRequests}
        projectId={projectId}
        onUpdate={setSupportRequests}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Support Requests Section (inside BuilderSection)
// ---------------------------------------------------------------------------

function SupportRequestsSection({
  requests,
  projectId,
  onUpdate,
}: {
  requests: SupportRequest[];
  projectId: string;
  onUpdate: (reqs: SupportRequest[]) => void;
}) {
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const openRequests = requests.filter((r) => r.status !== "resolved");
  const resolvedRequests = requests.filter((r) => r.status === "resolved");

  if (requests.length === 0) return null;

  const handleResolve = async (requestId: string) => {
    if (!resolution.trim()) return;
    setSubmitting(true);
    try {
      const updated = await fetchJsonThrow<SupportRequest>(
        `/api/delivery-projects/${projectId}/builder/support/${requestId}`,
        { method: "PATCH", body: JSON.stringify({ status: "resolved", resolution: resolution.trim() }) },
      );
      onUpdate(requests.map((r) => (r.id === requestId ? updated : r)));
      setResolvingId(null);
      setResolution("");
      toast.success("Request resolved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resolve");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkInProgress = async (requestId: string) => {
    try {
      const updated = await fetchJsonThrow<SupportRequest>(
        `/api/delivery-projects/${projectId}/builder/support/${requestId}`,
        { method: "PATCH", body: JSON.stringify({ status: "in_progress" }) },
      );
      onUpdate(requests.map((r) => (r.id === requestId ? updated : r)));
    } catch {
      toast.error("Failed to update status");
    }
  };

  return (
    <div className="border-t border-neutral-800 pt-3 space-y-2">
      <h3 className="text-xs font-medium text-neutral-400">Client Help Requests</h3>

      {openRequests.map((req) => (
        <div key={req.id} className="border border-neutral-800 rounded-lg p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-xs font-medium text-neutral-200">{req.subject}</span>
              <p className="text-xs text-neutral-500 mt-0.5">{req.message}</p>
            </div>
            <Badge variant="outline" className={`text-[10px] shrink-0 ${req.status === "in_progress" ? "text-blue-400" : "text-amber-400"}`}>
              {req.status === "in_progress" ? "In progress" : "Open"}
            </Badge>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-neutral-600">{formatDate(req.createdAt)}</span>
            {req.status === "open" && (
              <button onClick={() => handleMarkInProgress(req.id)} className="text-blue-400 hover:text-blue-300">
                Mark in progress
              </button>
            )}
            <button
              onClick={() => setResolvingId(resolvingId === req.id ? null : req.id)}
              className="text-emerald-400 hover:text-emerald-300"
            >
              {resolvingId === req.id ? "Cancel" : "Resolve"}
            </button>
          </div>

          {resolvingId === req.id && (
            <div className="space-y-2">
              <textarea
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="Describe what was done to resolve this..."
                rows={2}
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-neutral-500"
              />
              <Button size="sm" onClick={() => handleResolve(req.id)} disabled={submitting || !resolution.trim()}>
                {submitting ? "Resolving…" : "Submit resolution"}
              </Button>
            </div>
          )}
        </div>
      ))}

      {resolvedRequests.length > 0 && (
        <details className="text-xs">
          <summary className="text-neutral-500 cursor-pointer hover:text-neutral-400">
            {resolvedRequests.length} resolved {resolvedRequests.length === 1 ? "request" : "requests"}
          </summary>
          <div className="mt-2 space-y-1">
            {resolvedRequests.map((req) => (
              <div key={req.id} className="border border-neutral-800/50 rounded p-2 opacity-60">
                <span className="text-neutral-400">{req.subject}</span>
                {req.resolution && <p className="text-neutral-600 mt-0.5">{req.resolution}</p>}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Milestones Section with progress bar and status toggle
// ---------------------------------------------------------------------------

const MILESTONE_STATUSES = ["todo", "in_progress", "done", "blocked"] as const;
type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

const MILESTONE_COLORS: Record<MilestoneStatus, string> = {
  todo: "bg-neutral-700",
  in_progress: "bg-blue-500",
  done: "bg-emerald-500",
  blocked: "bg-red-500",
};

const MILESTONE_TEXT: Record<MilestoneStatus, string> = {
  todo: "text-neutral-400",
  in_progress: "text-blue-400",
  done: "text-emerald-400",
  blocked: "text-red-400",
};

function MilestonesSection({
  projectId,
  milestones,
  onUpdate,
}: {
  projectId: string;
  milestones: { id: string; title: string; status: string }[];
  onUpdate: () => void;
}) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const total = milestones.length;
  const doneCount = milestones.filter((m) => m.status === "done").length;
  const inProgressCount = milestones.filter((m) => m.status === "in_progress").length;
  const blockedCount = milestones.filter((m) => m.status === "blocked").length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  const cycleStatus = async (milestone: { id: string; status: string }) => {
    const order: MilestoneStatus[] = ["todo", "in_progress", "done"];
    const currentIdx = order.indexOf(milestone.status as MilestoneStatus);
    const nextStatus = order[(currentIdx + 1) % order.length]!;
    setUpdatingId(milestone.id);
    try {
      await fetchJsonThrow(`/api/delivery-projects/${projectId}/milestones/${milestone.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      onUpdate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="rounded-lg border border-neutral-800 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-neutral-400">Milestones</h2>
        <div className="flex items-center gap-3 text-xs text-neutral-500">
          <span>{doneCount}/{total} done</span>
          {inProgressCount > 0 && <span className="text-blue-400">{inProgressCount} active</span>}
          {blockedCount > 0 && <span className="text-red-400">{blockedCount} blocked</span>}
          <span className="font-medium text-neutral-300">{pct}%</span>
        </div>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="flex gap-0.5 h-2 rounded-full overflow-hidden bg-neutral-800">
          {milestones.map((m) => (
            <div
              key={m.id}
              className={`flex-1 transition-colors ${MILESTONE_COLORS[m.status as MilestoneStatus] ?? "bg-neutral-700"}`}
            />
          ))}
        </div>
      )}

      {/* Milestone list */}
      <div className="space-y-1">
        {milestones.map((m) => {
          const status = m.status as MilestoneStatus;
          const isUpdating = updatingId === m.id;
          return (
            <div key={m.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-neutral-800/30">
              <button
                onClick={() => cycleStatus(m)}
                disabled={!!updatingId}
                className="shrink-0"
                title={`${status} — click to advance`}
              >
                {isUpdating ? (
                  <Loader2 className="w-4 h-4 text-neutral-500 animate-spin" />
                ) : status === "done" ? (
                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 text-white text-[10px]">✓</span>
                ) : status === "in_progress" ? (
                  <span className="flex items-center justify-center w-4 h-4 rounded-full border-2 border-blue-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  </span>
                ) : status === "blocked" ? (
                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px]">✕</span>
                ) : (
                  <span className="flex items-center justify-center w-4 h-4 rounded-full border-2 border-neutral-600" />
                )}
              </button>
              <span className={`flex-1 text-sm ${status === "done" ? "text-neutral-500 line-through" : MILESTONE_TEXT[status]}`}>
                {m.title}
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] capitalize shrink-0 ${MILESTONE_TEXT[status]}`}
              >
                {status.replace(/_/g, " ")}
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function renderSectionFields(
  section: SectionEntry,
  idx: number,
  update: (idx: number, key: string, value: unknown) => void,
) {
  const p = section.props;
  const field = (key: string, label: string, multiline = false) => (
    <div key={key} className="space-y-1">
      <label className="text-xs text-neutral-500">{label}</label>
      {multiline ? (
        <textarea
          value={String(p[key] ?? "")}
          onChange={(e) => update(idx, key, e.target.value)}
          rows={3}
          className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-neutral-500"
        />
      ) : (
        <input
          value={String(p[key] ?? "")}
          onChange={(e) => update(idx, key, e.target.value)}
          className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-neutral-500"
        />
      )}
    </div>
  );

  switch (section.type) {
    case "hero":
      return <>{field("headline", "Headline")}{field("subheadline", "Subheadline", true)}{field("ctaText", "Button Text")}{field("ctaLink", "Button Link")}</>;
    case "about":
      return <>{field("title", "Title")}{field("body", "Body", true)}</>;
    case "services": {
      const items = (p.items as { name: string; description: string; price?: string }[]) ?? [];
      return (
        <>
          {field("title", "Title")}
          {items.map((item, i) => (
            <div key={i} className="grid grid-cols-3 gap-2">
              <input value={item.name} onChange={(e) => { const updated = [...items]; updated[i] = { ...updated[i], name: e.target.value }; update(idx, "items", updated); }} className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200" placeholder="Name" />
              <input value={item.description} onChange={(e) => { const updated = [...items]; updated[i] = { ...updated[i], description: e.target.value }; update(idx, "items", updated); }} className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200" placeholder="Description" />
              <input value={item.price ?? ""} onChange={(e) => { const updated = [...items]; updated[i] = { ...updated[i], price: e.target.value }; update(idx, "items", updated); }} className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200" placeholder="Price" />
            </div>
          ))}
          <button onClick={() => update(idx, "items", [...items, { name: "", description: "", price: "" }])} className="text-xs text-emerald-400 hover:text-emerald-300">+ Add service</button>
        </>
      );
    }
    case "testimonials": {
      const items = (p.items as { quote: string; author: string; role?: string }[]) ?? [];
      return (
        <>
          {field("title", "Title")}
          {items.map((item, i) => (
            <div key={i} className="grid grid-cols-3 gap-2">
              <input value={item.quote} onChange={(e) => { const updated = [...items]; updated[i] = { ...updated[i], quote: e.target.value }; update(idx, "items", updated); }} className="col-span-2 rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200" placeholder="Quote" />
              <input value={item.author} onChange={(e) => { const updated = [...items]; updated[i] = { ...updated[i], author: e.target.value }; update(idx, "items", updated); }} className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200" placeholder="Author" />
            </div>
          ))}
          <button onClick={() => update(idx, "items", [...items, { quote: "", author: "" }])} className="text-xs text-emerald-400 hover:text-emerald-300">+ Add testimonial</button>
        </>
      );
    }
    case "booking":
      return <>{field("title", "Title")}{field("body", "Body", true)}{field("ctaText", "Button Text")}{field("ctaLink", "Button Link")}</>;
    case "contact":
      return <>{field("title", "Title")}{field("body", "Body", true)}{field("email", "Email")}{field("phone", "Phone")}</>;
    case "footer":
      return <>{field("businessName", "Business Name")}{field("tagline", "Tagline")}</>;
    default:
      return <p className="text-xs text-neutral-500">Unknown section type</p>;
  }
}
