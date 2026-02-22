"use client";

import { useState } from "react";
import Link from "next/link";
import type { ProposalRow } from "@/app/dashboard/proposals/page";

type Buckets = {
  draft: ProposalRow[];
  approvedNotSent: ProposalRow[];
  sentAwaiting: ProposalRow[];
  won: ProposalRow[];
  lost: ProposalRow[];
};

type FollowUpQueue = {
  needsSequence: ProposalRow[];
  inProgress: ProposalRow[];
  stale: ProposalRow[];
};

const TABS = [
  { key: "draft", label: "Draft", count: (b: Buckets) => b.draft.length },
  { key: "approvedNotSent", label: "Approved, not sent", count: (b: Buckets) => b.approvedNotSent.length },
  { key: "sentAwaiting", label: "Sent", count: (b: Buckets) => b.sentAwaiting.length },
  { key: "won", label: "Won", count: (b: Buckets) => b.won.length },
  { key: "lost", label: "Lost", count: (b: Buckets) => b.lost.length },
] as const;

export function ProposalsWorkspace({ buckets, followUpQueue }: { buckets: Buckets; followUpQueue: FollowUpQueue }) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["key"]>("draft");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const rows = buckets[activeTab];
  const hasFollowUp = followUpQueue.needsSequence.length + followUpQueue.inProgress.length + followUpQueue.stale.length > 0;

  function exportSummaries() {
    const all = [
      ...buckets.draft.map((r) => ({ ...r, bucket: "draft" })),
      ...buckets.approvedNotSent.map((r) => ({ ...r, bucket: "approved_not_sent" })),
      ...buckets.sentAwaiting.map((r) => ({ ...r, bucket: "sent" })),
      ...buckets.won.map((r) => ({ ...r, bucket: "won" })),
      ...buckets.lost.map((r) => ({ ...r, bucket: "lost" })),
    ];
    const csv = [
      "Lead,Status,Score,Bucket,Has research snapshot",
      ...all.map((r) =>
        [r.title, r.status, r.score ?? "", r.bucket, r.hasResearchSnapshot ? "yes" : "no"].join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `proposals-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {hasFollowUp && (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h3 className="text-sm font-medium text-neutral-300 mb-3">Follow-up Queue</h3>
          <div className="grid gap-4 sm:grid-cols-3 text-sm">
            <div>
              <p className="text-neutral-500 text-xs uppercase tracking-wider mb-2">Needs sequence</p>
              <ul className="space-y-1">
                {followUpQueue.needsSequence.map((r) => (
                  <li key={r.leadId}>
                    <Link href={`/dashboard/leads/${r.leadId}`} className="text-neutral-200 hover:text-white">
                      {r.title}
                    </Link>
                  </li>
                ))}
                {followUpQueue.needsSequence.length === 0 && <span className="text-neutral-500">—</span>}
              </ul>
            </div>
            <div>
              <p className="text-neutral-500 text-xs uppercase tracking-wider mb-2">In progress</p>
              <ul className="space-y-1">
                {followUpQueue.inProgress.map((r) => (
                  <li key={r.leadId}>
                    <Link href={`/dashboard/leads/${r.leadId}`} className="text-neutral-200 hover:text-white">
                      {r.title}
                    </Link>
                  </li>
                ))}
                {followUpQueue.inProgress.length === 0 && <span className="text-neutral-500">—</span>}
              </ul>
            </div>
            <div>
              <p className="text-neutral-500 text-xs uppercase tracking-wider mb-2">Stale (no activity {">"}7d)</p>
              <ul className="space-y-1">
                {followUpQueue.stale.map((r) => (
                  <li key={r.leadId}>
                    <Link href={`/dashboard/leads/${r.leadId}`} className="text-amber-400 hover:text-amber-300">
                      {r.title}
                    </Link>
                  </li>
                ))}
                {followUpQueue.stale.length === 0 && <span className="text-neutral-500">—</span>}
              </ul>
            </div>
          </div>
        </section>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1 border-b border-neutral-800 pb-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-t text-sm ${
                activeTab === tab.key
                  ? "bg-neutral-800 text-neutral-100"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {tab.label} ({tab.count(buckets)})
            </button>
          ))}
        </div>
        <button
          onClick={exportSummaries}
          className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
        >
          Export summaries
        </button>
      </div>

      <section className="rounded-lg border border-neutral-800 overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-6 text-center text-neutral-500 text-sm">
            No proposals in this bucket.
          </div>
        ) : (
          <ul className="divide-y divide-neutral-800">
            {rows.map((row) => (
              <li key={row.leadId} className="bg-neutral-900/30">
                <div className="flex items-center justify-between gap-2 p-3">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <Link
                      href={`/dashboard/leads/${row.leadId}`}
                      className="font-medium text-neutral-200 hover:text-white truncate"
                    >
                      {row.title}
                    </Link>
                    {row.hasResearchSnapshot && (
                      <span className="rounded bg-emerald-950/50 text-emerald-400 text-xs px-1.5 py-0.5">
                        Why now
                      </span>
                    )}
                    {row.score != null && (
                      <span className="text-neutral-400 text-xs">Score {row.score}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-neutral-500 text-xs">{row.status}</span>
                    <button
                      onClick={() => setExpandedId(expandedId === row.leadId ? null : row.leadId)}
                      className="text-xs text-neutral-400 hover:text-white"
                    >
                      {expandedId === row.leadId ? "Hide" : "Preview"}
                    </button>
                    <Link
                      href={`/dashboard/proposals/${row.artifactId}`}
                      className="text-xs text-emerald-400 hover:text-emerald-300"
                    >
                      Console
                    </Link>
                    <Link
                      href={`/dashboard/leads/${row.leadId}`}
                      className="text-xs text-neutral-400 hover:text-white"
                    >
                      Lead →
                    </Link>
                  </div>
                </div>
                {expandedId === row.leadId && (
                  <div className="border-t border-neutral-800 bg-neutral-950/50 p-4">
                    <pre className="text-xs text-neutral-400 whitespace-pre-wrap font-sans max-h-60 overflow-y-auto">
                      {row.proposalContent}
                    </pre>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
