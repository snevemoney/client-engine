"use client";

import { use, useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProposalResponseFollowup } from "@/components/proposals/ProposalResponseFollowup";
import ProposalConsoleEditor from "@/components/proposals/ProposalConsoleEditor";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AsyncState } from "@/components/ui/AsyncState";
import { fetchJsonThrow } from "@/lib/http/fetch-json";

type Phase2Proposal = {
  id: string;
  status: string;
  title: string;
  clientName: string | null;
  company: string | null;
  summary: string | null;
  scopeOfWork: string | null;
  deliverables: unknown;
  cta: string | null;
  priceMin: number | null;
  priceMax: number | null;
  priceCurrency: string;
  intakeLead: { id: string; title: string; status: string } | null;
  pipelineLead: { id: string; title: string; status: string } | null;
  deliveryProjects?: { id: string; title: string; status: string; dueDate: string | null; completedAt: string | null }[];
  readiness: { isReady: boolean; reasons: string[]; warnings: string[] };
  sentAt?: string | null;
  viewedAt?: string | null;
  respondedAt?: string | null;
  meetingBookedAt?: string | null;
  lastContactedAt?: string | null;
  nextFollowUpAt?: string | null;
  followUpCount?: number;
  responseStatus?: string;
  responseSummary?: string | null;
  bookingUrlUsed?: string | null;
};

type ProposalArtifact = {
  id: string;
  leadId: string;
  title: string;
  content: string;
  meta: unknown;
  createdAt?: string;
  updatedAt?: string;
  lead?: { id: string; title: string; status: string } | null;
};

type PageData = { type: "proposal"; data: Phase2Proposal } | { type: "artifact"; data: ProposalArtifact };

const toastFn = (m: string, t?: "success" | "error") => t === "error" ? toast.error(m) : toast.success(m);

export default function ProposalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { confirm, dialogProps } = useConfirmDialog();

  const fetchData = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/proposals/${id}`, { cache: "no-store", signal: controller.signal });
      if (r.ok) {
        const d = await r.json();
        if (d?.id) { setPageData({ type: "proposal", data: d }); setLoading(false); return; }
      }
      const artRes = await fetch(`/api/artifacts/${id}`, { cache: "no-store", signal: controller.signal });
      if (artRes.ok) {
        const art = await artRes.json();
        if (art?.id && art.type === "proposal") { setPageData({ type: "artifact", data: art }); setLoading(false); return; }
      }
      setError("Proposal not found.");
    } catch (e) {
      if (e instanceof Error && (e.name === "AbortError" || e.message?.includes("aborted"))) return;
      setError("Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchData();
    return () => { abortRef.current?.abort(); };
  }, [fetchData]);

  const markReady = useAsyncAction(
    async () => { await fetchJsonThrow(`/api/proposals/${id}/mark-ready`, { method: "POST" }); void fetchData(); },
    { toast: toastFn, successMessage: "Marked ready" }
  );
  const markSent = useAsyncAction(
    async () => { await fetchJsonThrow(`/api/proposals/${id}/mark-sent`, { method: "POST" }); void fetchData(); },
    { toast: toastFn, successMessage: "Marked sent" }
  );
  const markViewed = useAsyncAction(
    async () => { await fetchJsonThrow(`/api/proposals/${id}/mark-viewed`, { method: "POST" }); void fetchData(); },
    { toast: toastFn, successMessage: "Marked viewed" }
  );
  const acceptAction = useAsyncAction(
    async () => { await fetchJsonThrow(`/api/proposals/${id}/accept`, { method: "POST", body: "{}" }); void fetchData(); },
    { toast: toastFn, successMessage: "Accepted" }
  );
  const rejectAction = useAsyncAction(
    async () => {
      const ok = await confirm({ title: "Reject this proposal?", variant: "destructive" });
      if (!ok) return;
      await fetchJsonThrow(`/api/proposals/${id}/reject`, { method: "POST", body: "{}" });
      void fetchData();
    },
    { toast: toastFn, successMessage: "Rejected" }
  );
  const duplicateAction = useAsyncAction(
    async () => { await fetchJsonThrow(`/api/proposals/${id}/duplicate`, { method: "POST" }); void fetchData(); },
    { toast: toastFn, successMessage: "Duplicated" }
  );

  const anyPending = markReady.pending || markSent.pending || markViewed.pending || acceptAction.pending || rejectAction.pending || duplicateAction.pending;

  const legacyRunAction = async (key: string, fn: () => Promise<Response>) => {
    try {
      const res = await fn();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data?.error ?? "Action failed"); return; }
      toast.success(`${key} completed`);
      void fetchData();
    } catch {
      toast.error("Action failed");
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <AsyncState loading={loading} error={error} onRetry={fetchData}>
        {pageData?.type === "artifact" && (
          <>
            <div>
              <Link href="/dashboard/proposals" className="text-sm text-neutral-400 hover:text-neutral-200">← Proposals</Link>
              {pageData.data.lead && (
                <div className="mt-2">
                  <Link href={`/dashboard/leads/${pageData.data.lead.id}`} className="text-sm text-emerald-400 hover:underline">
                    Lead: {pageData.data.lead.title} →
                  </Link>
                </div>
              )}
            </div>
            <ProposalConsoleEditor
              artifact={{
                id: pageData.data.id,
                leadId: pageData.data.leadId,
                title: pageData.data.title ?? "Proposal",
                content: pageData.data.content ?? "",
                meta: pageData.data.meta ?? {},
                updatedAt: pageData.data.updatedAt ?? pageData.data.createdAt ?? new Date().toISOString(),
              }}
            />
          </>
        )}

        {pageData?.type === "proposal" && (() => {
          const proposal = pageData.data;
          const deliverables = Array.isArray(proposal.deliverables)
            ? proposal.deliverables
            : (proposal.deliverables as { items?: string[] })?.items ?? [];

          return (
            <>
              <div>
                <Link href="/dashboard/proposals" className="text-sm text-neutral-400 hover:text-neutral-200">← Proposals</Link>
                <div className="flex items-center gap-3 mt-2">
                  <h1 className="text-2xl font-semibold">{proposal.title}</h1>
                  <Badge variant="outline" className="capitalize">{proposal.status.replace(/_/g, " ")}</Badge>
                </div>
                <p className="text-neutral-400 mt-1">{proposal.clientName ?? proposal.company ?? "—"}</p>
                {(proposal.intakeLead || proposal.pipelineLead || (proposal.deliveryProjects && proposal.deliveryProjects.length > 0)) && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-2 text-xs">
                    {proposal.intakeLead && (
                      <><Link href={`/dashboard/intake/${proposal.intakeLead.id}`} className="text-blue-400 hover:underline">Intake: {proposal.intakeLead.title}</Link><span className="text-neutral-600">→</span></>
                    )}
                    {proposal.pipelineLead && (
                      <><Link href={`/dashboard/leads/${proposal.pipelineLead.id}`} className="text-neutral-300 hover:underline">Lead: {proposal.pipelineLead.title}</Link><span className="text-neutral-600">→</span></>
                    )}
                    <span className="text-amber-400 font-medium">Proposal</span>
                    {proposal.deliveryProjects && proposal.deliveryProjects.length > 0 && (
                      <><span className="text-neutral-600">→</span>{proposal.deliveryProjects.map((dp, i) => (
                        <span key={dp.id} className="inline-flex items-center gap-1">
                          {i > 0 && <span className="text-neutral-600">,</span>}
                          <Link href={`/dashboard/delivery/${dp.id}`} className="text-emerald-400 hover:underline">{dp.title}</Link>
                          {dp.completedAt && <span className="text-emerald-600">(done)</span>}
                        </span>
                      ))}</>
                    )}
                  </div>
                )}
              </div>

              {["sent", "viewed"].includes(proposal.status) && (
                <ProposalResponseFollowup proposal={proposal} onAction={legacyRunAction} actionLoading={anyPending ? "action" : null} />
              )}

              {proposal.readiness && (
                <div className="rounded-lg border border-neutral-800 p-4">
                  <h3 className="text-sm font-medium text-neutral-400 mb-2">Readiness</h3>
                  {proposal.readiness.isReady ? (
                    <p className="text-emerald-400 text-sm">Ready to send</p>
                  ) : (
                    <ul className="text-sm text-amber-400">{proposal.readiness.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
                  )}
                  {proposal.readiness.warnings?.length > 0 && (
                    <ul className="text-xs text-neutral-500 mt-2">{proposal.readiness.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                  )}
                </div>
              )}

              <div className="space-y-4 text-sm">
                {proposal.summary && <div><h3 className="text-neutral-500 font-medium mb-1">Summary</h3><p className="text-neutral-300 whitespace-pre-wrap">{proposal.summary}</p></div>}
                {proposal.scopeOfWork && <div><h3 className="text-neutral-500 font-medium mb-1">Scope</h3><p className="text-neutral-300 whitespace-pre-wrap">{proposal.scopeOfWork}</p></div>}
                {deliverables.length > 0 && (
                  <div><h3 className="text-neutral-500 font-medium mb-1">Deliverables</h3>
                    <ul className="list-disc pl-4 text-neutral-300">{deliverables.map((d, i) => <li key={i}>{typeof d === "string" ? d : (d as { label?: string }).label ?? String(d)}</li>)}</ul>
                  </div>
                )}
                {(proposal.priceMin != null || proposal.priceMax != null) && (
                  <div><h3 className="text-neutral-500 font-medium mb-1">Price</h3>
                    <p>{proposal.priceMin != null && proposal.priceMax != null && proposal.priceMin !== proposal.priceMax
                      ? `${proposal.priceCurrency} ${proposal.priceMin.toLocaleString("en-US")} – ${proposal.priceMax.toLocaleString("en-US")}`
                      : proposal.priceMin != null ? `${proposal.priceCurrency} ${proposal.priceMin.toLocaleString("en-US")}` : `${proposal.priceCurrency} ${proposal.priceMax?.toLocaleString("en-US")}`}</p>
                  </div>
                )}
                {proposal.cta && <div><h3 className="text-neutral-500 font-medium mb-1">CTA</h3><p className="text-neutral-300">{proposal.cta}</p></div>}
              </div>

              <div className="flex flex-wrap gap-2">
                {proposal.status === "draft" && (
                  <Button size="sm" onClick={() => void markReady.execute()} disabled={!proposal.readiness?.isReady || anyPending}>
                    {markReady.pending ? "…" : "Mark Ready"}
                  </Button>
                )}
                {proposal.status === "ready" && (
                  <Button size="sm" onClick={() => void markSent.execute()} disabled={anyPending}>
                    {markSent.pending ? "…" : "Mark Sent"}
                  </Button>
                )}
                {proposal.status === "sent" && (
                  <Button variant="outline" size="sm" onClick={() => void markViewed.execute()} disabled={anyPending}>
                    {markViewed.pending ? "…" : "Mark Viewed"}
                  </Button>
                )}
                {["sent", "viewed"].includes(proposal.status) && (
                  <>
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => void acceptAction.execute()} disabled={anyPending}>
                      {acceptAction.pending ? "…" : "Accept"}
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-400" onClick={() => void rejectAction.execute()} disabled={anyPending}>
                      {rejectAction.pending ? "…" : "Reject"}
                    </Button>
                  </>
                )}
                <Button variant="outline" size="sm" onClick={() => void duplicateAction.execute()} disabled={anyPending}>
                  {duplicateAction.pending ? "…" : "Duplicate"}
                </Button>
              </div>
            </>
          );
        })()}
      </AsyncState>
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
