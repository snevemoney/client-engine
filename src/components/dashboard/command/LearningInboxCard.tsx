"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";

export function LearningInboxCard({
  proposalCount,
  latestSource,
}: {
  proposalCount: number;
  latestSource: string | null;
}) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-2">Learning Inbox</h2>
      <p className="text-xs text-neutral-500 mb-3">
        Improvement proposals from ingested videos. Human approves before apply.
      </p>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-neutral-200">
            {proposalCount} proposal{proposalCount !== 1 ? "s" : ""}
          </p>
          {latestSource && (
            <p className="text-xs text-neutral-500 truncate" title={latestSource}>
              Latest: {latestSource}
            </p>
          )}
        </div>
        <Link
          href="/dashboard/learning"
          className="shrink-0 inline-flex items-center gap-2 rounded-md bg-neutral-100 text-neutral-900 px-3 py-2 text-sm font-medium hover:bg-neutral-200"
        >
          <BookOpen className="w-4 h-4" />
          Open Learning
        </Link>
      </div>
    </section>
  );
}
