"use client";

import Link from "next/link";
import { Youtube, AlertTriangle, Eye, BookMarked } from "lucide-react";

export function YouTubeIngestSummaryCard({
  transcriptsThisWeek,
  failedJobs,
  pendingProposals,
  promotedCount,
}: {
  transcriptsThisWeek: number;
  failedJobs: number;
  pendingProposals: number;
  promotedCount: number;
}) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
        <Youtube className="w-4 h-4 text-red-500" /> YouTube Ingest
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div>
          <p className="text-lg font-semibold text-neutral-100">{transcriptsThisWeek}</p>
          <p className="text-xs text-neutral-500">Transcripts this week</p>
        </div>
        <div>
          <p className={`text-lg font-semibold ${failedJobs > 0 ? "text-amber-400" : "text-neutral-100"}`}>
            {failedJobs > 0 && <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />}
            {failedJobs}
          </p>
          <p className="text-xs text-neutral-500">Failed jobs</p>
        </div>
        <div>
          <p className={`text-lg font-semibold ${pendingProposals > 0 ? "text-blue-400" : "text-neutral-100"}`}>
            {pendingProposals > 0 && <Eye className="w-3.5 h-3.5 inline mr-1" />}
            {pendingProposals}
          </p>
          <p className="text-xs text-neutral-500">Pending review</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-neutral-100">
            {promotedCount > 0 && <BookMarked className="w-3.5 h-3.5 inline mr-1 text-purple-400" />}
            {promotedCount}
          </p>
          <p className="text-xs text-neutral-500">Promoted</p>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Link
          href="/dashboard/youtube"
          className="inline-flex items-center gap-2 rounded-md bg-neutral-100 text-neutral-900 px-3 py-1.5 text-sm font-medium hover:bg-neutral-200"
        >
          <Youtube className="w-4 h-4" />
          Open YouTube Ingest
        </Link>
      </div>
    </section>
  );
}
