"use client";

import Link from "next/link";
import { Library } from "lucide-react";

type Suggestion = {
  id: string;
  title: string;
  content: string;
  meta: unknown;
  createdAt: Date | string;
};

export function TopSuggestionsCard({ suggestions }: { suggestions: Suggestion[] }) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-2">Top Suggested Improvements</h2>
      <p className="text-xs text-neutral-500 mb-3">
        Highest-impact ideas from transcript learning. Review and apply in Knowledge.
      </p>
      {suggestions.length === 0 ? (
        <p className="text-xs text-neutral-500">No suggestions yet. Ingest videos in Knowledge.</p>
      ) : (
        <ul className="space-y-2 mb-3">
          {suggestions.map((s) => {
            const meta = s.meta as { systemArea?: string; expectedImpact?: string } | null;
            return (
              <li key={s.id} className="text-sm">
                <span className="font-medium text-neutral-200">{s.title}</span>
                {meta?.systemArea && <span className="text-neutral-500 ml-1">· {meta.systemArea}</span>}
              </li>
            );
          })}
        </ul>
      )}
      <Link
        href="/dashboard/knowledge"
        className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-200"
      >
        <Library className="w-4 h-4" />
        View all in Knowledge
      </Link>
    </section>
  );
}
