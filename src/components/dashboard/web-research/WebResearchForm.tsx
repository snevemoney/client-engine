"use client";

import { useState } from "react";
import { Search, Loader2, Globe, Target, Code } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { fetchJsonThrow } from "@/lib/http/fetch-json";
import { WebResearchBriefCard } from "./WebResearchBriefCard";
import type { WebResearchResult } from "@/lib/web-research/types";

type WebResearchMode = "deep" | "competitive" | "technical";

const MODES: { key: WebResearchMode; label: string; icon: React.ElementType; description: string }[] = [
  { key: "deep", label: "Deep", icon: Globe, description: "Multi-source synthesis" },
  { key: "competitive", label: "Competitive", icon: Target, description: "Competitor analysis" },
  { key: "technical", label: "Technical", icon: Code, description: "Tech stack research" },
];

export function WebResearchForm() {
  const [query, setQuery] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [mode, setMode] = useState<WebResearchMode>("deep");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WebResearchResult | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setResult(null);
    try {
      const data = await fetchJsonThrow<WebResearchResult>("/api/research/web", {
        method: "POST",
        body: JSON.stringify({
          query: query.trim(),
          mode,
          targetUrl: targetUrl.trim() || undefined,
        }),
      });
      setResult(data);
      if (data.ok) {
        toast.success(`Research complete — ${data.sourcesScraped} sources analyzed`);
      } else {
        toast.error(data.errors?.[0] ?? "Research failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Research failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-medium text-neutral-300">Web Research</h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          Research any topic, company, or tech stack from the open web.
        </p>
      </div>

      <form onSubmit={handleSearch} className="border border-neutral-800 rounded-lg p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Research topic *</label>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Next.js e-commerce platforms, AI chatbot competitors"
              required
              className="bg-neutral-900 border-neutral-700"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Target URL (optional)</label>
            <Input
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://company.com"
              type="url"
              className="bg-neutral-900 border-neutral-700"
            />
          </div>
        </div>

        {/* Mode selector */}
        <div className="flex gap-2">
          {MODES.map((m) => {
            const Icon = m.icon;
            const active = mode === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  active
                    ? "bg-neutral-700 text-neutral-100"
                    : "bg-neutral-900 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800"
                }`}
              >
                <Icon className="h-3 w-3" />
                {m.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={loading || !query.trim()} size="sm">
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Search className="h-3.5 w-3.5 mr-1.5" />
            )}
            {loading ? "Researching…" : "Research"}
          </Button>
          {result?.ok && (
            <span className="text-[10px] text-neutral-500">
              {result.sourcesScraped} sources · ${result.costEstimate.toFixed(4)} · {(result.durationMs / 1000).toFixed(1)}s
            </span>
          )}
        </div>
      </form>

      {/* Results */}
      {result?.ok && result.content && (
        <WebResearchBriefCard
          mode={result.mode}
          title={query}
          content={result.content}
          sourcesScraped={result.sourcesScraped}
          costEstimate={result.costEstimate}
          durationMs={result.durationMs}
          defaultExpanded
        />
      )}

      {result && !result.ok && (
        <div className="border border-red-900/50 rounded-lg p-3 bg-red-950/20 text-xs text-red-400">
          {result.errors.map((e, i) => (
            <p key={i}>· {e}</p>
          ))}
        </div>
      )}
    </div>
  );
}
