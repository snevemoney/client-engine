"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type ListToolbarStateProps = {
  totalText?: string;
  filtersSummary?: string;
  children?: React.ReactNode;
  className?: string;
};

/**
 * Phase 2.8.3: Lightweight toolbar strip for list pages.
 * Left: total results + optional filters summary.
 * Right: pagination controls slot.
 */
export function ListToolbarState({
  totalText,
  filtersSummary,
  children,
  className,
}: ListToolbarStateProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 py-2 text-sm",
        className
      )}
    >
      <div className="flex items-center gap-2 text-neutral-400">
        {totalText && <span>{totalText}</span>}
        {filtersSummary && (
          <span className="text-neutral-500">· {filtersSummary}</span>
        )}
      </div>
      {children}
    </div>
  );
}
