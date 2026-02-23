export default function KnowledgeLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-36 rounded bg-muted" />
      <div className="h-4 w-80 rounded bg-muted" />
      <div className="border border-neutral-800 rounded-lg p-6 space-y-4">
        <div className="h-5 w-48 rounded bg-muted" />
        <div className="flex gap-4">
          <div className="h-10 flex-1 rounded bg-muted" />
          <div className="h-10 w-28 rounded bg-muted" />
        </div>
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-8 w-28 rounded bg-muted" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="border border-neutral-800 rounded-lg p-4 h-24 bg-muted/30" />
        ))}
      </div>
    </div>
  );
}
