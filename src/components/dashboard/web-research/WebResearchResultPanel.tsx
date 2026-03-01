"use client";

import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fetchJsonThrow } from "@/lib/http/fetch-json";
import { WebResearchBriefCard } from "./WebResearchBriefCard";
import type { WebResearchResult } from "@/lib/web-research/types";

type Props = {
  /** Title of the prospect/result to research */
  title: string;
  /** URL of the prospect (used as targetUrl for competitive mode) */
  url?: string;
  /** Optional description for context */
  description?: string;
};

/**
 * Inline research panel for a prospect result.
 * Shows a research button that expands into a brief.
 */
export function WebResearchResultPanel({ title, url, description }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WebResearchResult | null>(null);

  async function handleResearch() {
    setLoading(true);
    try {
      const data = await fetchJsonThrow<WebResearchResult>("/api/research/web", {
        method: "POST",
        body: JSON.stringify({
          query: `${title}${description ? `. ${description}` : ""}`,
          mode: "deep",
          targetUrl: url || undefined,
        }),
      });
      setResult(data);
      if (!data.ok) {
        toast.error(data.errors?.[0] ?? "Research failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Research failed");
    } finally {
      setLoading(false);
    }
  }

  if (result?.ok && result.content) {
    return (
      <div className="mt-2 ml-2">
        <WebResearchBriefCard
          mode={result.mode}
          title={title}
          content={result.content}
          sourcesScraped={result.sourcesScraped}
          costEstimate={result.costEstimate}
          durationMs={result.durationMs}
          defaultExpanded
        />
      </div>
    );
  }

  if (result && !result.ok) {
    return (
      <div className="mt-2 ml-2 border border-red-900/50 rounded-lg p-2 bg-red-950/20 text-[10px] text-red-400">
        {result.errors.map((e, i) => <p key={i}>· {e}</p>)}
      </div>
    );
  }

  return (
    <button
      onClick={handleResearch}
      disabled={loading}
      className="p-1.5 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 transition-colors disabled:opacity-50"
      title="Research this prospect"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Search className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
