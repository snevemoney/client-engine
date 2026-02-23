export default function MetricsLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-8 w-56 rounded bg-muted" />
      <div className="h-4 w-72 rounded bg-muted" />
      <div className="border border-amber-900/50 rounded-lg p-4 h-24 bg-muted/20" />
      <div className="border border-neutral-800 rounded-lg p-6 space-y-3">
        <div className="h-5 w-40 rounded bg-muted" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-16 rounded border border-neutral-800 bg-muted/30" />
          ))}
        </div>
      </div>
      <div className="border border-neutral-800 rounded-lg p-6 space-y-3">
        <div className="h-5 w-44 rounded bg-muted" />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-14 rounded border border-neutral-800 bg-muted/30" />
          ))}
        </div>
      </div>
      <div className="h-48 rounded-lg bg-muted" />
    </div>
  );
}
