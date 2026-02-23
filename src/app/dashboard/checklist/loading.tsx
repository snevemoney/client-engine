export default function ChecklistLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-32 rounded bg-muted" />
      <div className="h-4 w-80 rounded bg-muted" />
      <div className="border border-neutral-800 rounded-lg p-6 space-y-4">
        <div className="h-5 w-44 rounded bg-muted" />
        <div className="h-3 w-64 rounded bg-muted" />
        <div className="flex gap-4">
          <div className="h-10 flex-1 max-w-md rounded bg-muted" />
          <div className="h-10 w-36 rounded bg-muted" />
        </div>
      </div>
      <div className="border border-neutral-800 rounded-lg overflow-hidden">
        <div className="h-10 bg-muted/50 border-b border-neutral-800" />
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="px-6 py-4 border-t border-neutral-800/50 space-y-2">
            <div className="h-3 w-40 rounded bg-muted" />
            <div className="h-16 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
