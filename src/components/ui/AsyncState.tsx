"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type AsyncStateProps = {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyMessage?: string;
  onRetry?: () => void;
  children: React.ReactNode;
  className?: string;
  loadingClassName?: string;
};

/**
 * Phase 2.6: Reusable loading / error / empty / success UI.
 */
export function AsyncState({
  loading,
  error,
  empty,
  emptyMessage = "No data",
  onRetry,
  children,
  className,
  loadingClassName,
}: AsyncStateProps) {
  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-12", loadingClassName ?? className)}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-600 border-t-neutral-300" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-3 py-12 text-center", className)}>
        <p className="text-sm text-red-400">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md border border-neutral-600 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-700"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (empty) {
    return (
      <div className={cn("py-12 text-center text-sm text-neutral-500", className)}>
        {emptyMessage}
      </div>
    );
  }

  return <>{children}</>;
}
