"use client";

import { use, useState, useEffect } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProposalResponseFollowup } from "@/components/proposals/ProposalResponseFollowup";

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

export default function ProposalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [proposal, setProposal] = useState<Phase2Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/proposals/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (d && d.id) {
          setProposal(d);
          setError(null);
        } else {
          setProposal(null);
          setError("Proposal not found.");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProposal(null);
          setError("Failed to load.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  const runAction = async (key: string, fn: () => Promise<Response>) => {
    setActionLoading(key);
    try {
      const res = await fn();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? "Action failed");
        return;
      }
      window.location.reload();
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <p className="text-neutral-500">Loading…</p>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div>
        <p className="text-neutral-500">{error ?? "Not found."}</p>
        <Link href="/dashboard/proposals" className="text-emerald-400 hover:underline mt-2 inline-block">
          ← Proposals
        </Link>
      </div>
    );
  }

  const deliverables = Array.isArray(proposal.deliverables)
    ? proposal.deliverables
    : (proposal.deliverables as { items?: string[] })?.items ?? [];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/dashboard/proposals" className="text-sm text-neutral-400 hover:text-neutral-200">
          ← Proposals
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-2xl font-semibold">{proposal.title}</h1>
          <Badge variant="outline" className="capitalize">{proposal.status.replace(/_/g, " ")}</Badge>
        </div>
        <p className="text-neutral-400 mt-1">{proposal.clientName ?? proposal.company ?? "—"}</p>
        {proposal.intakeLead && (
          <Link href={`/dashboard/intake/${proposal.intakeLead.id}`} className="text-xs text-emerald-400 hover:underline">
            From intake: {proposal.intakeLead.title}
          </Link>
        )}
      </div>

      {["sent", "viewed"].includes(proposal.status) && (
        <ProposalResponseFollowup
          proposal={proposal}
          onAction={runAction}
          actionLoading={actionLoading}
        />
      )}

      {proposal.readiness && (
        <div className="rounded-lg border border-neutral-800 p-4">
          <h3 className="text-sm font-medium text-neutral-400 mb-2">Readiness</h3>
          {proposal.readiness.isReady ? (
            <p className="text-emerald-400 text-sm">Ready to send</p>
          ) : (
            <ul className="text-sm text-amber-400">
              {proposal.readiness.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
          {proposal.readiness.warnings?.length > 0 && (
            <ul className="text-xs text-neutral-500 mt-2">
              {proposal.readiness.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="space-y-4 text-sm">
        {proposal.summary && (
          <div>
            <h3 className="text-neutral-500 font-medium mb-1">Summary</h3>
            <p className="text-neutral-300 whitespace-pre-wrap">{proposal.summary}</p>
          </div>
        )}
        {proposal.scopeOfWork && (
          <div>
            <h3 className="text-neutral-500 font-medium mb-1">Scope</h3>
            <p className="text-neutral-300 whitespace-pre-wrap">{proposal.scopeOfWork}</p>
          </div>
        )}
        {deliverables.length > 0 && (
          <div>
            <h3 className="text-neutral-500 font-medium mb-1">Deliverables</h3>
            <ul className="list-disc pl-4 text-neutral-300">
              {deliverables.map((d, i) => (
                <li key={i}>{typeof d === "string" ? d : (d as { label?: string }).label ?? String(d)}</li>
              ))}
            </ul>
          </div>
        )}
        {(proposal.priceMin != null || proposal.priceMax != null) && (
          <div>
            <h3 className="text-neutral-500 font-medium mb-1">Price</h3>
            <p>
              {proposal.priceMin != null && proposal.priceMax != null && proposal.priceMin !== proposal.priceMax
                ? `${proposal.priceCurrency} ${proposal.priceMin.toLocaleString("en-US")} – ${proposal.priceMax.toLocaleString("en-US")}`
                : proposal.priceMin != null
                  ? `${proposal.priceCurrency} ${proposal.priceMin.toLocaleString("en-US")}`
                  : `${proposal.priceCurrency} ${proposal.priceMax?.toLocaleString("en-US")}`}
            </p>
          </div>
        )}
        {proposal.cta && (
          <div>
            <h3 className="text-neutral-500 font-medium mb-1">CTA</h3>
            <p className="text-neutral-300">{proposal.cta}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {proposal.status === "draft" && (
          <Button
            size="sm"
            onClick={() => runAction("ready", () => fetch(`/api/proposals/${id}/mark-ready`, { method: "POST" }))}
            disabled={!proposal.readiness?.isReady || !!actionLoading}
          >
            Mark Ready
          </Button>
        )}
        {proposal.status === "ready" && (
          <Button
            size="sm"
            onClick={() => runAction("sent", () => fetch(`/api/proposals/${id}/mark-sent`, { method: "POST" }))}
            disabled={!!actionLoading}
          >
            Mark Sent
          </Button>
        )}
        {proposal.status === "sent" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => runAction("viewed", () => fetch(`/api/proposals/${id}/mark-viewed`, { method: "POST" }))}
            disabled={!!actionLoading}
          >
            Mark Viewed
          </Button>
        )}
        {["sent", "viewed"].includes(proposal.status) && (
          <>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => runAction("accept", () => fetch(`/api/proposals/${id}/accept`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }))}
              disabled={!!actionLoading}
            >
              Accept
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-400"
              onClick={() => runAction("reject", () => fetch(`/api/proposals/${id}/reject`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }))}
              disabled={!!actionLoading}
            >
              Reject
            </Button>
          </>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => runAction("duplicate", () => fetch(`/api/proposals/${id}/duplicate`, { method: "POST" }))}
          disabled={!!actionLoading}
        >
          Duplicate
        </Button>
      </div>
    </div>
  );
}
