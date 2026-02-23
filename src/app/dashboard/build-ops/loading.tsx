export default function BuildOpsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded bg-muted" />
      <div className="h-4 w-80 rounded bg-muted" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-8 w-20 rounded bg-muted" />
        ))}
      </div>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="border border-neutral-800 rounded-lg p-4 space-y-2">
          <div className="h-5 w-64 rounded bg-muted" />
          <div className="flex gap-2">
            <div className="h-4 w-16 rounded bg-muted" />
            <div className="h-4 w-16 rounded bg-muted" />
          </div>
          <div className="h-3 w-48 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
