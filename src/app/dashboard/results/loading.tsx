export default function ResultsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded bg-muted" />
      <div className="h-4 w-72 rounded bg-muted" />
      <div className="border border-neutral-800 rounded-lg overflow-hidden">
        <div className="h-10 bg-muted/50" />
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3 border-t border-neutral-800/50">
            <div className="h-4 w-40 rounded bg-muted" />
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-4 w-20 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
