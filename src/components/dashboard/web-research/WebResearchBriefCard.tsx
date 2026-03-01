"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  ChevronDown,
  ChevronUp,
  Globe,
  Brain,
  Code,
  Target,
  UserPlus,
  BookOpen,
  GraduationCap,
  Loader2,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { fetchJsonThrow } from "@/lib/http/fetch-json";

type Destination = "lead" | "knowledge" | "learning" | "strategy";

type Props = {
  mode: "deep" | "competitive" | "technical";
  /** Research topic / query title */
  title?: string;
  content: string;
  sourcesScraped: number;
  costEstimate?: number;
  durationMs?: number;
  createdAt?: string;
  defaultExpanded?: boolean;
  /** Hide action buttons (e.g. when displayed read-only) */
  hideActions?: boolean;
};

const MODE_CONFIG = {
  deep: { label: "Deep Research", icon: Globe, color: "bg-blue-900/50 text-blue-300" },
  competitive: { label: "Competitive", icon: Target, color: "bg-violet-900/50 text-violet-300" },
  technical: { label: "Technical", icon: Code, color: "bg-emerald-900/50 text-emerald-300" },
} as const;

const DESTINATIONS: { key: Destination; label: string; icon: React.ElementType; toast: string }[] = [
  { key: "lead", label: "Lead", icon: UserPlus, toast: "Saved as lead" },
  { key: "knowledge", label: "Knowledge", icon: BookOpen, toast: "Added to Knowledge" },
  { key: "learning", label: "Learning", icon: GraduationCap, toast: "Added to Learning" },
  { key: "strategy", label: "Strategy", icon: Target, toast: "Added to Strategy notes" },
];

export function WebResearchBriefCard({
  mode,
  title,
  content,
  sourcesScraped,
  costEstimate,
  durationMs,
  createdAt,
  defaultExpanded = false,
  hideActions = false,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [saving, setSaving] = useState<Destination | null>(null);
  const [savedTo, setSavedTo] = useState<Set<Destination>>(new Set());
  const config = MODE_CONFIG[mode];
  const ModeIcon = config.icon;

  async function handleSaveTo(destination: Destination) {
    if (savedTo.has(destination) || saving) return;
    setSaving(destination);
    try {
      await fetchJsonThrow("/api/research/web/save-to", {
        method: "POST",
        body: JSON.stringify({
          destination,
          title: title ?? "Web Research",
          content,
          mode,
        }),
      });
      setSavedTo((prev) => new Set(prev).add(destination));
      const dest = DESTINATIONS.find((d) => d.key === destination);
      toast.success(dest?.toast ?? "Saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="border border-neutral-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-neutral-900/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Brain className="h-3.5 w-3.5 text-neutral-400" />
          <span className="text-xs font-medium text-neutral-300">Web Research Brief</span>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${config.color}`}>
            <ModeIcon className="h-2.5 w-2.5" />
            {config.label}
          </span>
          <span className="text-[10px] text-neutral-600">
            {sourcesScraped} sources
            {costEstimate !== undefined && ` · $${costEstimate.toFixed(4)}`}
            {durationMs !== undefined && ` · ${(durationMs / 1000).toFixed(1)}s`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {createdAt && (
            <span className="text-[10px] text-neutral-600">
              {new Date(createdAt).toLocaleDateString()}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-neutral-500" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-neutral-500" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-neutral-800 p-4">
          {/* Markdown content */}
          <ReactMarkdown
            components={{
              h1: ({ children }) => <h1 className="text-base font-semibold text-neutral-200 mb-2">{children}</h1>,
              h2: ({ children }) => <h2 className="text-sm font-medium text-neutral-200 mt-4 mb-1">{children}</h2>,
              h3: ({ children }) => <h3 className="text-xs font-medium text-neutral-300 mt-3 mb-1">{children}</h3>,
              p: ({ children }) => <p className="text-xs text-neutral-400 mb-1">{children}</p>,
              strong: ({ children }) => <strong className="text-neutral-200 font-medium">{children}</strong>,
              em: ({ children }) => <em className="text-neutral-300">{children}</em>,
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  {children}
                </a>
              ),
              ul: ({ children }) => <ul className="space-y-0.5 my-1">{children}</ul>,
              ol: ({ children }) => <ol className="space-y-0.5 my-1 list-decimal ml-4">{children}</ol>,
              li: ({ children }) => <li className="text-xs text-neutral-400">{children}</li>,
              hr: () => <hr className="border-neutral-800 my-3" />,
            }}
          >
            {content}
          </ReactMarkdown>

          {/* Action buttons */}
          {!hideActions && title && (
            <div className="flex items-center gap-1.5 pt-3 border-t border-neutral-800 mt-3">
              <span className="text-[10px] text-neutral-600 mr-1">Save to:</span>
              {DESTINATIONS.map((dest) => {
                const DestIcon = dest.icon;
                const isSaved = savedTo.has(dest.key);
                const isSaving = saving === dest.key;
                return (
                  <button
                    key={dest.key}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSaveTo(dest.key);
                    }}
                    disabled={isSaved || isSaving}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                      isSaved
                        ? "bg-green-900/30 text-green-400"
                        : "bg-neutral-800 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-700 disabled:opacity-50"
                    }`}
                  >
                    {isSaving ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    ) : isSaved ? (
                      <Check className="h-2.5 w-2.5" />
                    ) : (
                      <DestIcon className="h-2.5 w-2.5" />
                    )}
                    {dest.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
