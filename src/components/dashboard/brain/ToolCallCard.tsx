/**
 * Inline tool call display for the AI Brain chat.
 * Shows tool name, execution status, and collapsible result details.
 */
"use client";

import { useState } from "react";
import type { ToolCallPart } from "@/hooks/useBrainChat";

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  get_business_snapshot: "Reading business health",
  get_executive_brief: "Pulling executive brief",
  get_pipeline: "Checking pipeline",
  get_growth_summary: "Reviewing growth pipeline",
  search_knowledge: "Searching knowledge base",
  get_memory_patterns: "Analyzing your patterns",
  run_risk_rules: "Running risk rules",
  run_next_actions: "Generating next actions",
  recompute_score: "Recomputing score",
  execute_nba: "Executing action",
  draft_outreach: "Drafting outreach",
  get_ops_health: "Checking system health",
};

export function ToolCallCard({ data }: { data: ToolCallPart }) {
  const [expanded, setExpanded] = useState(false);
  const displayName = TOOL_DISPLAY_NAMES[data.name] ?? data.name;
  const isComplete = data.status === "complete";
  const hasError = !!data.error;

  return (
    <div className="rounded-md border border-neutral-700/50 my-2 overflow-hidden bg-neutral-800/30">
      <button
        type="button"
        onClick={() => isComplete && setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left"
        disabled={!isComplete}
      >
        {/* Status indicator */}
        {!isComplete ? (
          <span className="w-3.5 h-3.5 shrink-0">
            <svg
              className="animate-spin w-3.5 h-3.5 text-amber-400"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </span>
        ) : hasError ? (
          <span className="w-3.5 h-3.5 shrink-0 text-red-400">✕</span>
        ) : (
          <span className="w-3.5 h-3.5 shrink-0 text-emerald-400">✓</span>
        )}

        <span className="text-xs font-medium text-neutral-300 flex-1">
          {displayName}
        </span>

        {isComplete && (
          <svg
            className={`w-3 h-3 text-neutral-500 transition-transform ${
              expanded ? "rotate-90" : ""
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        )}
      </button>

      {expanded && isComplete && (
        <div className="px-3 pb-2 text-xs text-neutral-400 border-t border-neutral-700/30">
          {hasError && (
            <p className="text-red-400 mt-1">Error: {data.error}</p>
          )}
          {data.result != null ? (
            <details className="mt-1">
              <summary className="cursor-pointer text-neutral-500 hover:text-neutral-400">
                View data
              </summary>
              <pre className="mt-1 overflow-x-auto max-h-40 text-neutral-500 text-[10px] leading-tight">
                {JSON.stringify(data.result, null, 2)}
              </pre>
            </details>
          ) : null}
        </div>
      )}
    </div>
  );
}
