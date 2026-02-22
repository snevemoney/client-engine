"use client";

import Link from "next/link";
import { Wrench } from "lucide-react";
import type { BuildOpsSummary } from "@/lib/ops/buildTasks";

export function BuildOpsCard({ data }: { data: BuildOpsSummary }) {
  const { todo, inProgress, review, total } = data;
  const needsAttention = todo + inProgress + review;

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-2 flex items-center gap-2">
        <Wrench className="w-4 h-4 text-neutral-500" />
        Build Ops Queue
      </h2>
      <p className="text-xs text-neutral-500 mb-3">
        Bugs, refactors, features, guardrails. Give Cursor Cloud Agent a clear list; review before merge.
      </p>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-medium text-neutral-200">
            {total} task{total !== 1 ? "s" : ""} · {needsAttention} to do / in progress / in review
          </p>
          {(todo > 0 || inProgress > 0) && (
            <p className="text-xs text-neutral-500 mt-0.5">
              Todo: {todo} · In progress: {inProgress} · Review: {review}
            </p>
          )}
        </div>
        <Link
          href="/dashboard/build-ops"
          className="shrink-0 inline-flex items-center gap-2 rounded-md bg-neutral-100 text-neutral-900 px-3 py-2 text-sm font-medium hover:bg-neutral-200"
        >
          <Wrench className="w-4 h-4" />
          Open Build Ops
        </Link>
      </div>
    </section>
  );
}
