"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PaginationControlsProps = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  isLoading?: boolean;
  className?: string;
};

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/**
 * Phase 2.8.3: Reusable pagination controls for list pages.
 */
export function PaginationControls({
  page,
  pageSize,
  total,
  totalPages,
  hasNext,
  hasPrev,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  isLoading = false,
  className,
}: PaginationControlsProps) {
  const disabled = isLoading || total === 0;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 text-sm",
        className
      )}
    >
      <div className="flex items-center gap-2 text-neutral-400">
        <span>{total.toLocaleString("en-US")} items</span>
        {totalPages > 1 && (
          <span className="text-neutral-500">
            · Page {page} of {totalPages}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {onPageSizeChange && pageSizeOptions.length > 0 && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(parseInt(e.target.value, 10))}
            disabled={disabled}
            className="rounded-md border border-neutral-600 bg-neutral-800 px-2 py-1 text-sm text-neutral-200 disabled:opacity-50"
            aria-label="Items per page"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n} per page
              </option>
            ))}
          </select>
        )}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={disabled || !hasPrev}
            aria-label="Previous page"
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={disabled || !hasNext}
            aria-label="Next page"
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
