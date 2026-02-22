"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import ProposalConsoleEditor from "@/components/proposals/ProposalConsoleEditor";

type Artifact = {
  id: string;
  leadId: string;
  type: string;
  title: string;
  content: string;
  meta: unknown;
  createdAt: string;
  lead: { id: string; title: string; status: string; proposalSentAt: string | null };
};

export default function ProposalConsolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/artifacts/${id}`);
        if (!res.ok) {
          setError(res.status === 404 ? "Proposal not found." : "Failed to load.");
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (data.type !== "proposal") {
          setError("This artifact is not a proposal.");
          setLoading(false);
          return;
        }
        setArtifact(data);
      } catch {
        if (!cancelled) setError("Failed to load.");
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-200 p-6">
        <p className="text-neutral-400">Loading proposal…</p>
      </div>
    );
  }

  if (error || !artifact) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-200 p-6">
        <p className="text-neutral-400">{error ?? "Not found."}</p>
        <Link href="/dashboard/proposals" className="text-emerald-400 hover:underline mt-2 inline-block">
          ← Back to Proposals
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/proposals"
            className="text-neutral-400 hover:text-white flex items-center gap-1"
          >
            ← Proposals
          </Link>
          <span className="text-neutral-500">/</span>
          <Link
            href={`/dashboard/leads/${artifact.lead.id}`}
            className="text-emerald-400 hover:underline truncate max-w-[200px] sm:max-w-none"
          >
            {artifact.lead.title}
          </Link>
        </div>
      </div>

      {artifact.lead.proposalSentAt && (
        <p className="text-xs text-neutral-500 mb-4">
          Lead marked sent: {new Date(artifact.lead.proposalSentAt).toLocaleString()}
        </p>
      )}

      <ProposalConsoleEditor
        artifact={{
          id: artifact.id,
          leadId: artifact.leadId,
          title: artifact.title,
          content: artifact.content,
          meta: artifact.meta,
          updatedAt: artifact.createdAt,
        }}
        onSaved={(updated) => setArtifact((prev) => (prev ? { ...prev, ...updated } : null))}
      />

      {/* Full proposal (raw markdown) */}
      <section className="mt-8">
        <details className="group">
          <summary className="text-sm text-neutral-500 cursor-pointer hover:text-neutral-300">
            Full proposal (raw markdown)
          </summary>
          <pre className="mt-2 p-4 rounded-lg border border-neutral-800 bg-neutral-900/30 whitespace-pre-wrap text-xs overflow-x-auto max-h-96 overflow-y-auto text-neutral-400">
            {artifact.content}
          </pre>
        </details>
      </section>
    </div>
  );
}
