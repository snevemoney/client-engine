"use client";

type DegradedBannerProps = {
  reason?: string;
  onRetry?: () => void;
  "data-testid"?: string;
};

export function DegradedBanner({ reason, onRetry, "data-testid": dataTestId }: DegradedBannerProps) {
  return (
    <div
      className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300"
      data-testid={dataTestId ?? "degraded-banner"}
    >
      {reason || "Data temporarily unavailable — showing limited information."}
      {onRetry && (
        <button type="button" onClick={onRetry} className="ml-2 underline hover:text-amber-200">
          Retry
        </button>
      )}
    </div>
  );
}
