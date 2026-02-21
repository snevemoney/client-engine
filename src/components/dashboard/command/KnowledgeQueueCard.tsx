"use client";

import Link from "next/link";
import { Library } from "lucide-react";

export function KnowledgeQueueCard({
  transcriptsToday,
  insightsToday,
  suggestionsToday,
  suggestionQueuedTotal,
}: {
  transcriptsToday: number;
  insightsToday: number;
  suggestionsToday: number;
  suggestionQueuedTotal: number;
}) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-2">Knowledge Queue</h2>
      <p className="text-xs text-neutral-500 mb-3">
        Today: new transcripts, insights, improvement suggestions. All queued for review.
      </p>
      <ul className="text-sm text-neutral-400 space-y-1 mb-3">
        <li>Transcripts today: {transcriptsToday}</li>
        <li>Insights today: {insightsToday}</li>
        <li>Suggestions today: {suggestionsToday}</li>
        <li>Queued for review: {suggestionQueuedTotal}</li>
      </ul>
      <Link
        href="/dashboard/knowledge"
        className="inline-flex items-center gap-2 rounded-md bg-neutral-100 text-neutral-900 px-3 py-2 text-sm font-medium hover:bg-neutral-200"
      >
        <Library className="w-4 h-4" />
        Open Knowledge
      </Link>
    </section>
  );
}
