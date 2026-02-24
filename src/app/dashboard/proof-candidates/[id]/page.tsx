"use client";

import { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type Candidate = {
  id: string;
  title: string;
  company: string | null;
  triggerType: string;
  sourceType: string;
  status: string;
  githubUrl: string | null;
  loomUrl: string | null;
  deliverySummary: string | null;
  proofSnippet: string | null;
  beforeState: string | null;
  afterState: string | null;
  metricLabel: string | null;
  metricValue: string | null;
  tags: string[];
  intakeLeadId: string | null;
  promotedProofRecordId: string | null;
  readiness?: { isReady: boolean; reasons: string[] };
};

export default function ProofCandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [loomUrl, setLoomUrl] = useState("");
  const [deliverySummary, setDeliverySummary] = useState("");
  const [proofSnippet, setProofSnippet] = useState("");
  const [beforeState, setBeforeState] = useState("");
  const [afterState, setAfterState] = useState("");
  const [metricLabel, setMetricLabel] = useState("");
  const [metricValue, setMetricValue] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchCandidate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proof-candidates/${id}`, { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Failed to load");
        setCandidate(null);
        return;
      }
      setCandidate(data);
      setTitle(data.title ?? "");
      setCompany(data.company ?? "");
      setGithubUrl(data.githubUrl ?? "");
      setLoomUrl(data.loomUrl ?? "");
      setDeliverySummary(data.deliverySummary ?? "");
      setProofSnippet(data.proofSnippet ?? "");
      setBeforeState(data.beforeState ?? "");
      setAfterState(data.afterState ?? "");
      setMetricLabel(data.metricLabel ?? "");
      setMetricValue(data.metricValue ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setCandidate(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchCandidate();
  }, [fetchCandidate]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/proof-candidates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim() || undefined,
          company: company.trim() || null,
          githubUrl: githubUrl.trim() || null,
          loomUrl: loomUrl.trim() || null,
          deliverySummary: deliverySummary.trim() || null,
          proofSnippet: proofSnippet.trim() || null,
          beforeState: beforeState.trim() || null,
          afterState: afterState.trim() || null,
          metricLabel: metricLabel.trim() || null,
          metricValue: metricValue.trim() || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(typeof data?.error === "string" ? data.error : "Save failed");
        return;
      }
      void fetchCandidate();
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (action: string, fn: () => Promise<Response>) => {
    setActionLoading(action);
    try {
      const res = await fn();
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(typeof data?.error === "string" ? data.error : `Action failed (${res.status})`);
        return;
      }
      void fetchCandidate();
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && !candidate) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/proof-candidates" className="text-neutral-400 hover:text-neutral-200 text-sm flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="py-12 text-center text-neutral-500">Loading…</div>
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/proof-candidates" className="text-neutral-400 hover:text-neutral-200 text-sm flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <p className="text-red-400">{error ?? "Not found."}</p>
      </div>
    );
  }

  const isPromoted = candidate.status === "promoted";
  const isRejected = candidate.status === "rejected";

  return (
    <div className="space-y-6">
      <Link href="/dashboard/proof-candidates" className="text-neutral-400 hover:text-neutral-200 text-sm flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to Proof Candidates
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{candidate.title || "—"}</h1>
          <div className="flex gap-2 mt-1">
            <Badge variant={candidate.status === "promoted" ? "success" : candidate.status === "rejected" ? "destructive" : "default"}>
              {candidate.status}
            </Badge>
            <Badge variant="outline">{candidate.triggerType}</Badge>
            {candidate.intakeLeadId && (
              <Link href={`/dashboard/intake/${candidate.intakeLeadId}`} className="text-xs text-blue-400 hover:underline">
                View intake
              </Link>
            )}
          </div>
        </div>
        {isPromoted && candidate.promotedProofRecordId && (
          <Link href="/dashboard/proof">
            <Button variant="outline" size="sm">View in Proof</Button>
          </Link>
        )}
      </div>

      {candidate.readiness && (
        <div className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-3">
          <h3 className="text-sm font-medium text-neutral-300 mb-2">Readiness</h3>
          {candidate.readiness.isReady ? (
            <p className="text-sm text-emerald-400">Ready to promote</p>
          ) : (
            <ul className="text-sm text-amber-400 list-disc list-inside">
              {candidate.readiness.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="border border-neutral-700 rounded-lg p-4 space-y-4">
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isPromoted || isRejected}
            className="bg-neutral-800 border-neutral-600"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Company</label>
          <Input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            disabled={isPromoted || isRejected}
            className="bg-neutral-800 border-neutral-600"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-neutral-500 mb-1">GitHub URL</label>
            <Input
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/..."
              disabled={isPromoted || isRejected}
              className="bg-neutral-800 border-neutral-600"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Loom URL</label>
            <Input
              value={loomUrl}
              onChange={(e) => setLoomUrl(e.target.value)}
              placeholder="https://loom.com/..."
              disabled={isPromoted || isRejected}
              className="bg-neutral-800 border-neutral-600"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Delivery summary</label>
          <Textarea
            value={deliverySummary}
            onChange={(e) => setDeliverySummary(e.target.value)}
            rows={2}
            disabled={isPromoted || isRejected}
            className="bg-neutral-800 border-neutral-600 resize-none"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Proof snippet</label>
          <Textarea
            value={proofSnippet}
            onChange={(e) => setProofSnippet(e.target.value)}
            rows={3}
            disabled={isPromoted || isRejected}
            className="bg-neutral-800 border-neutral-600 resize-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Before state</label>
            <Input
              value={beforeState}
              onChange={(e) => setBeforeState(e.target.value)}
              disabled={isPromoted || isRejected}
              className="bg-neutral-800 border-neutral-600"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">After state</label>
            <Input
              value={afterState}
              onChange={(e) => setAfterState(e.target.value)}
              disabled={isPromoted || isRejected}
              className="bg-neutral-800 border-neutral-600"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Metric label</label>
            <Input
              value={metricLabel}
              onChange={(e) => setMetricLabel(e.target.value)}
              disabled={isPromoted || isRejected}
              className="bg-neutral-800 border-neutral-600"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Metric value</label>
            <Input
              value={metricValue}
              onChange={(e) => setMetricValue(e.target.value)}
              disabled={isPromoted || isRejected}
              className="bg-neutral-800 border-neutral-600"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isPromoted && !isRejected && (
            <>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!!actionLoading}
                onClick={() =>
                  runAction("ready", () =>
                    fetch(`/api/proof-candidates/${id}/mark-ready`, { method: "POST", credentials: "include" })
                  )
                }
              >
                {actionLoading === "ready" ? "…" : "Mark Ready"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-emerald-400"
                disabled={!!actionLoading}
                onClick={() =>
                  runAction("promote", () =>
                    fetch(`/api/proof-candidates/${id}/promote`, { method: "POST", credentials: "include" })
                  )
                }
              >
                {actionLoading === "promote" ? "…" : "Promote to Proof"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-400"
                disabled={!!actionLoading}
                onClick={() =>
                  runAction("reject", () =>
                    fetch(`/api/proof-candidates/${id}/reject`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({}),
                    })
                  )
                }
              >
                {actionLoading === "reject" ? "…" : "Reject"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
