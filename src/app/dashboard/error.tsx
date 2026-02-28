"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <p className="text-sm text-red-400">Something went wrong</p>
      <p className="max-w-md text-xs text-neutral-500">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md border border-neutral-600 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-700"
      >
        Try again
      </button>
    </div>
  );
}
