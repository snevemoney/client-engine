"use client";

import { useState } from "react";
import {
  Search,
  Loader2,
  ExternalLink,
  Plus,
  Sparkles,
  ArrowRight,
  Mail,
  Globe,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { fetchJsonThrow } from "@/lib/http/fetch-json";
import { WebResearchResultPanel } from "@/components/dashboard/web-research/WebResearchResultPanel";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import ReactMarkdown from "react-markdown";

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

type ParsedQuery = {
  clientType: string;
  industry?: string;
  keywords: string[];
  platforms: string[];
  count: number;
  location?: string;
};

type AiProspectReport = {
  ok: boolean;
  parsed: ParsedQuery;
  results: ProspectResult[];
  brief: string;
  followUps: string[];
  platformBreakdown: { platform: string; count: number }[];
  durationMs: number;
  errors: string[];
};

const PLATFORM_COLORS: Record<string, string> = {
  facebook: "bg-blue-900/50 text-blue-300",
  x: "bg-neutral-800 text-neutral-300",
  linkedin: "bg-blue-900/50 text-blue-300",
  instagram: "bg-pink-900/50 text-pink-300",
  upwork: "bg-green-900/50 text-green-300",
  google: "bg-violet-900/50 text-violet-300",
  youtube: "bg-red-900/50 text-red-300",
  yelp: "bg-red-900/50 text-red-300",
};

const PLATFORM_LABELS: Record<string, string> = {
  facebook: "Facebook",
  x: "X / Twitter",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  upwork: "Upwork",
  google: "Google",
  youtube: "YouTube",
  yelp: "Yelp",
};

const TIER_STYLES: Record<string, { label: string; color: string; icon: string }> = {
  CRITICAL_GAP: { label: "Critical Gap", color: "bg-red-950/50 text-red-400 border-red-800/30", icon: "🔴" },
  SCATTERED_LINKS: { label: "Scattered Links", color: "bg-amber-950/50 text-amber-400 border-amber-800/30", icon: "🟠" },
  BASIC_SITE: { label: "Basic Site", color: "bg-yellow-950/50 text-yellow-400 border-yellow-800/30", icon: "🟡" },
  HAS_WEBSITE: { label: "Has Website", color: "bg-emerald-950/50 text-emerald-400 border-emerald-800/30", icon: "🟢" },
};

export function AiProspectSearch() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<AiProspectReport | null>(null);
  const [converting, setConverting] = useState<Set<string>>(new Set());
  const [showBrief, setShowBrief] = useState(true);
  const [showCards, setShowCards] = useState(false);
  const { confirm, dialogProps } = useConfirmDialog();

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setReport(null);
    setShowBrief(true);
    setShowCards(false);
    try {
      const data = await fetchJsonThrow<AiProspectReport>("/api/prospect/ai", {
        method: "POST",
        body: JSON.stringify({ query: query.trim() }),
      });
      setReport(data);
      if (data.ok) {
        toast.success(
          `Found ${data.results.length} prospects across ${data.platformBreakdown.length} platform${data.platformBreakdown.length !== 1 ? "s" : ""}`,
        );
      } else {
        toast.error(data.errors?.[0] ?? "Search failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  function handleFollowUp(followUp: string) {
    const ctx = report?.parsed;
    const parts: string[] = [followUp];
    if (ctx) {
      parts.push(`for ${ctx.clientType}`);
      if (ctx.platforms.length > 0) {
        parts.push(`on ${ctx.platforms.join(" and ")}`);
      }
      if (ctx.location) {
        parts.push(`in ${ctx.location}`);
      }
    }
    const contextualQuery = parts.join(" ");

    setQuery(contextualQuery);
    setReport(null);
    setShowBrief(true);
    setShowCards(false);
    setLoading(true);
    fetchJsonThrow<AiProspectReport>("/api/prospect/ai", {
      method: "POST",
      body: JSON.stringify({ query: contextualQuery }),
    })
      .then((data) => {
        setReport(data);
        if (data.ok) {
          toast.success(`Found ${data.results.length} prospects`);
        }
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Follow-up search failed");
      })
      .finally(() => setLoading(false));
  }

  async function convertToLead(result: ProspectResult) {
    if (
      !(await confirm({
        title: "Convert to lead?",
        body: `Add "${result.title}" as a new lead.`,
        confirmLabel: "Convert",
      }))
    )
      return;
    setConverting((prev) => new Set(prev).add(result.id));
    try {
      await fetchJsonThrow("/api/leads", {
        method: "POST",
        body: JSON.stringify({
          title: result.title,
          source: `ai-prospect-${result.source}`,
          sourceUrl: result.url,
          description: result.description,
          tags: result.tags,
        }),
      });
      toast.success("Converted to lead");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to convert");
    } finally {
      setConverting((prev) => {
        const next = new Set(prev);
        next.delete(result.id);
        return next;
      });
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-400" />
          <h2 className="text-sm font-medium text-neutral-300">AI Prospect Search</h2>
        </div>
        <p className="text-xs text-neutral-500 mt-0.5">
          Describe who you&apos;re looking for. Searches platforms, visits profiles, audits bio links, and qualifies prospects.
        </p>
      </div>

      <form onSubmit={handleSearch} className="border border-neutral-800 rounded-lg p-4 space-y-3">
        <div>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find 20 coaches on instagram and linkedin with weak infrastructure…"
            required
            className="bg-neutral-900 border-neutral-700"
          />
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
          {loading && (
            <span className="text-[10px] text-neutral-500 animate-pulse">
              Searching platforms, visiting profiles, auditing bio links…
            </span>
          )}
          {report?.ok && (
            <span className="text-[10px] text-neutral-500">
              {report.results.length} prospects · {(report.durationMs / 1000).toFixed(1)}s
            </span>
          )}
        </div>
      </form>

      {/* Parsed query breakdown */}
      {report?.ok && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-neutral-600">Parsed:</span>
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-neutral-800 text-neutral-300">
            {report.parsed.clientType}
          </span>
          {report.parsed.keywords.map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] bg-neutral-800/60 text-neutral-400"
            >
              {kw}
            </span>
          ))}
          {report.parsed.platforms.map((p) => (
            <span
              key={p}
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                PLATFORM_COLORS[p] ?? "bg-neutral-800 text-neutral-300"
              }`}
            >
              {PLATFORM_LABELS[p] ?? p}
            </span>
          ))}
          {report.parsed.location && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] bg-neutral-800/60 text-neutral-400">
              {report.parsed.location}
            </span>
          )}
        </div>
      )}

      {/* Follow-up suggestions */}
      {report?.ok && report.followUps.length > 0 && (
        <div className="flex items-start gap-2 flex-wrap">
          <span className="text-[10px] text-neutral-600 mt-1">Follow up:</span>
          {report.followUps.map((fu, i) => (
            <button
              key={i}
              onClick={() => handleFollowUp(fu)}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] bg-violet-950/40 text-violet-300 hover:bg-violet-900/50 transition-colors border border-violet-800/30 disabled:opacity-50"
            >
              <ArrowRight className="h-2.5 w-2.5" />
              {fu}
            </button>
          ))}
        </div>
      )}

      {/* Errors */}
      {report?.errors && report.errors.length > 0 && (
        <div className="border border-amber-800/50 rounded-lg p-3 bg-amber-950/20 text-xs text-amber-400">
          {report.errors.map((e, i) => (
            <p key={i}>{e}</p>
          ))}
        </div>
      )}

      {/* Brief / Report */}
      {report?.ok && report.brief && (
        <div className="border border-neutral-800 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowBrief((v) => !v)}
            className="w-full flex items-center justify-between p-3 text-left hover:bg-neutral-900/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-sm font-medium text-neutral-300">Prospect Brief</span>
              <span className="text-[10px] text-neutral-600">
                {report.results.length} prospects analyzed
              </span>
            </div>
            {showBrief ? (
              <ChevronUp className="h-3.5 w-3.5 text-neutral-500" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-neutral-500" />
            )}
          </button>
          {showBrief && (
            <div className="border-t border-neutral-800 p-4 prose prose-invert prose-sm max-w-none text-neutral-300 [&_table]:text-xs [&_table]:border-neutral-700 [&_th]:border-neutral-700 [&_td]:border-neutral-700 [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_p]:text-xs [&_li]:text-xs [&_strong]:text-neutral-200">
              <ReactMarkdown>{report.brief}</ReactMarkdown>
            </div>
          )}
        </div>
      )}

      {/* Individual prospect cards (collapsible) */}
      {report?.ok && report.results.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowCards((v) => !v)}
            className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-300 transition-colors"
          >
            {showCards ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            Individual Prospect Cards ({report.results.length})
          </button>

          {showCards && (
            <div className="divide-y divide-neutral-800 border border-neutral-800 rounded-lg overflow-hidden">
              {report.results.map((result) => {
                const meta = (result.meta ?? {}) as Record<string, unknown>;
                const name = meta.name as string | undefined;
                const handle = meta.handle as string | undefined;
                const niche = meta.niche as string | undefined;
                const followers = meta.followers as string | undefined;
                const tier = meta.tier as string | undefined;
                const currentWebPresence = meta.currentWebPresence as string | undefined;
                const bookingFlow = meta.bookingFlow as string | undefined;
                const salesOpportunity = meta.salesOpportunity as string | undefined;
                const hasWebsite = meta.hasWebsite as boolean | undefined;
                const missingInfra = (meta.missingInfrastructure ?? []) as string[];
                const services = (meta.services ?? []) as string[];
                const qualReason = meta.qualificationReason as string | undefined;
                const contactInfo = meta.contactInfo as string | undefined;
                const opportunityScore = meta.opportunityScore as number | undefined;
                const pageScraped = meta.pageScraped as boolean | undefined;
                const tierStyle = tier ? TIER_STYLES[tier] : undefined;

                return (
                  <div key={result.id} className="p-4 hover:bg-neutral-900/50 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {/* Header: tier + platform + score */}
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {tierStyle && (
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${tierStyle.color}`}>
                              {tierStyle.icon} {tierStyle.label}
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              PLATFORM_COLORS[result.source] ?? "bg-neutral-800 text-neutral-300"
                            }`}
                          >
                            {PLATFORM_LABELS[result.source] ?? result.source}
                          </span>
                          {opportunityScore != null && (
                            <span className="text-[10px] text-neutral-500 tabular-nums font-medium">
                              {opportunityScore}/10
                            </span>
                          )}
                          {hasWebsite === true && (
                            <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] bg-emerald-950/50 text-emerald-400">
                              <CheckCircle2 className="h-2.5 w-2.5" /> has website
                            </span>
                          )}
                          {hasWebsite === false && (
                            <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] bg-red-950/50 text-red-400">
                              <XCircle className="h-2.5 w-2.5" /> no website
                            </span>
                          )}
                          {!pageScraped && (
                            <span className="text-[10px] text-neutral-700">not scraped</span>
                          )}
                        </div>

                        {/* Name + handle + niche */}
                        <div className="flex items-baseline gap-2">
                          <h4 className="text-sm font-medium text-neutral-200">
                            {name || result.title}
                          </h4>
                          {handle && (
                            <span className="text-[11px] text-neutral-500">{handle}</span>
                          )}
                          {followers && (
                            <span className="text-[10px] text-neutral-600">{followers} followers</span>
                          )}
                        </div>
                        {niche && (
                          <p className="text-[11px] text-violet-400/70">{niche}</p>
                        )}

                        {/* Description / business summary */}
                        <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">
                          {result.description}
                        </p>

                        {/* Web presence + booking + opportunity */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1 mt-2 text-[11px]">
                          {currentWebPresence && (
                            <div>
                              <span className="text-neutral-600">Web:</span>{" "}
                              <span className="text-neutral-400">{currentWebPresence}</span>
                            </div>
                          )}
                          {bookingFlow && (
                            <div>
                              <span className="text-neutral-600">Booking:</span>{" "}
                              <span className="text-neutral-400">{bookingFlow}</span>
                            </div>
                          )}
                          {salesOpportunity && (
                            <div>
                              <span className="text-neutral-600">Opportunity:</span>{" "}
                              <span className="text-amber-400/80">{salesOpportunity}</span>
                            </div>
                          )}
                        </div>

                        {/* Qualification reason */}
                        {qualReason && (
                          <p className="text-[11px] text-violet-400/60 mt-1 italic">
                            {qualReason}
                          </p>
                        )}

                        {/* Tags: missing infra + services */}
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {missingInfra.map((gap) => (
                            <span
                              key={gap}
                              className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] bg-amber-950/40 text-amber-400 border border-amber-800/20"
                            >
                              <AlertTriangle className="h-2.5 w-2.5" />
                              {gap}
                            </span>
                          ))}
                          {services.slice(0, 3).map((svc) => (
                            <span
                              key={svc}
                              className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] bg-neutral-800/80 text-neutral-400"
                            >
                              {svc}
                            </span>
                          ))}
                          {contactInfo && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-neutral-500">
                              <Mail className="h-2.5 w-2.5" />
                              {contactInfo}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <WebResearchResultPanel
                          title={result.title}
                          url={result.url}
                          description={result.description}
                        />
                        {result.url && (
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 transition-colors"
                            title="Open link"
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
                );
              })}
            </div>
          )}
        </div>
      )}

      {report?.ok && report.results.length === 0 && (
        <div className="border border-neutral-800 rounded-lg p-8 text-center">
          <p className="text-sm text-neutral-500">No prospects found.</p>
          <p className="text-xs text-neutral-600 mt-1">
            Try broader search terms or different platforms.
          </p>
        </div>
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
