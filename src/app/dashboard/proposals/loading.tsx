export default function ProposalsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-40 rounded bg-muted" />
      <div className="h-4 w-80 rounded bg-muted" />
      <div className="flex gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-8 w-24 rounded bg-muted" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-40 rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
