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
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-2xl font-semibold">{project.title}</h1>
          <Badge variant="outline" className="capitalize">{project.status.replace(/_/g, " ")}</Badge>
          <Badge variant="outline" className={project.health === "overdue" ? "text-red-400" : project.health === "due_soon" ? "text-amber-400" : ""}>
            {project.health.replace(/_/g, " ")}
          </Badge>
        </div>
        <p className="text-neutral-400 mt-1">{project.clientName ?? project.company ?? "—"}</p>
      </div>

      <div className="grid gap-4 text-sm">
        <div><span className="text-neutral-500">Due:</span> {formatDate(project.dueDate)}</div>
        {project.githubUrl && <div><a href={project.githubUrl} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">GitHub</a></div>}
        {project.loomUrl && <div><a href={project.loomUrl} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">Loom</a></div>}
      </div>

      {project.summary && (
        <div>
          <h2 className="text-sm font-medium text-neutral-500 mb-1">Summary</h2>
          <p className="text-neutral-300">{project.summary}</p>
        </div>
      )}

      <div>
        <h2 className="text-sm font-medium text-neutral-500 mb-2">Milestones</h2>
        <ul className="space-y-1">
          {project.milestones.map((m) => (
            <li key={m.id} className="flex items-center gap-2">
              <span className={m.status === "done" ? "text-emerald-400" : ""}>{m.title}</span>
              <Badge variant="outline" className="text-xs capitalize">{m.status}</Badge>
            </li>
          ))}
        </ul>
      </div>

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
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
