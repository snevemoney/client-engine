"use client";

import { useState } from "react";
import { Search, ExternalLink, Plus, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ProspectResult = {
  id: string;
  source: string;
  title: string;
  description: string;
  url?: string;
  contactPath?: string;
  tags: string[];
  confidence: number;
  meta?: Record<string, unknown>;
};

type ProspectReport = {
  id: string;
  criteria: Record<string, unknown>;
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "error";
  results: ProspectResult[];
  sourcesSearched: string[];
  totalApiCalls: number;
  errors: string[];
};

const SOURCE_COLORS: Record<string, string> = {
  github: "bg-neutral-700 text-neutral-200",
  rss: "bg-orange-900/50 text-orange-300",
  upwork: "bg-green-900/50 text-green-300",
  linkedin: "bg-blue-900/50 text-blue-300",
  hubspot: "bg-orange-900/50 text-orange-300",
  stripe: "bg-purple-900/50 text-purple-300",
  calendly: "bg-sky-900/50 text-sky-300",
  calcom: "bg-sky-900/50 text-sky-300",
};

export default function ProspectPage() {
  const [clientType, setClientType] = useState("");
  const [industry, setIndustry] = useState("");
  const [keywords, setKeywords] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ProspectReport | null>(null);
  const [converting, setConverting] = useState<Set<string>>(new Set());

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!clientType.trim()) return;
    setLoading(true);
    setReport(null);
    try {
      const res = await fetch("/api/prospect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientType: clientType.trim(),
          industry: industry.trim() || undefined,
          keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
          location: location.trim() || undefined,
        }),
      });
      if (res.ok) {
        setReport(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }

  async function convertToLead(result: ProspectResult) {
    setConverting((prev) => new Set(prev).add(result.id));
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: result.title,
          source: result.source,
          sourceUrl: result.url,
          description: result.description,
          tags: result.tags,
          contactName: result.contactPath || undefined,
        }),
      });
    } finally {
      setConverting((prev) => {
        const next = new Set(prev);
        next.delete(result.id);
        return next;
      });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Prospect Research</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Search across all your connected integrations to find prospects matching your criteria.
        </p>
      </div>

      <form onSubmit={handleSearch} className="border border-neutral-800 rounded-lg p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-neutral-500 mb-1.5">Type of client *</label>
            <Input
              value={clientType}
              onChange={(e) => setClientType(e.target.value)}
              placeholder="e.g. SaaS founders, ecommerce operators, agencies"
              required
              className="bg-neutral-900 border-neutral-700"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1.5">Industry</label>
            <Input
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="e.g. healthcare, fintech, real estate"
              className="bg-neutral-900 border-neutral-700"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-neutral-500 mb-1.5">Keywords (comma-separated)</label>
            <Input
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="e.g. automation, CRM, sales ops"
              className="bg-neutral-900 border-neutral-700"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1.5">Location</label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. US, Europe, remote"
              className="bg-neutral-900 border-neutral-700"
            />
          </div>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={loading || !clientType.trim()}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            {loading ? "Searching all sources…" : "Search prospects"}
          </Button>
          {report && (
            <span className="text-xs text-neutral-500">
              {report.results.length} results from {report.sourcesSearched.length} sources
              {report.totalApiCalls > 0 && ` · ${report.totalApiCalls} API calls`}
            </span>
          )}
        </div>
      </form>

      {report?.errors.length ? (
        <div className="border border-amber-800/50 rounded-lg p-4 bg-amber-950/20">
          <div className="flex items-start gap-2 text-xs text-amber-400">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium mb-1">Some sources had issues:</p>
              <ul className="space-y-0.5 text-amber-400/80">
                {report.errors.map((e, i) => (
                  <li key={i}>· {e}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {report && report.results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-sm font-medium text-neutral-300">
              Results ({report.results.length})
            </h2>
            <div className="flex gap-1.5 flex-wrap">
              {[...new Set(report.results.map((r) => r.source))].map((source) => (
                <span
                  key={source}
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    SOURCE_COLORS[source] ?? "bg-neutral-800 text-neutral-300"
                  }`}
                >
                  {source} ({report.results.filter((r) => r.source === source).length})
                </span>
              ))}
            </div>
          </div>

          <div className="divide-y divide-neutral-800 border border-neutral-800 rounded-lg overflow-hidden">
            {report.results.map((result) => (
              <div
                key={result.id}
                className="p-4 hover:bg-neutral-900/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          SOURCE_COLORS[result.source] ?? "bg-neutral-800 text-neutral-300"
                        }`}
                      >
                        {result.source}
                      </span>
                      <span className="text-[10px] text-neutral-600 tabular-nums">
                        {Math.round(result.confidence * 100)}% match
                      </span>
                    </div>
                    <h3 className="text-sm font-medium text-neutral-200 truncate">
                      {result.title}
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">
                      {result.description}
                    </p>
                    {result.tags.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {result.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] bg-neutral-800/80 text-neutral-400"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {result.url && (
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <button
                      onClick={() => convertToLead(result)}
                      disabled={converting.has(result.id)}
                      className="p-1.5 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 transition-colors disabled:opacity-50"
                      title="Convert to lead"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {report && report.results.length === 0 && report.status !== "error" && (
        <div className="border border-neutral-800 rounded-lg p-8 text-center">
          <p className="text-sm text-neutral-500">No prospects found matching your criteria.</p>
          <p className="text-xs text-neutral-600 mt-1">
            Try broader search terms, or check that your integrations are configured and enabled in Settings.
          </p>
        </div>
      )}
    </div>
  );
}
