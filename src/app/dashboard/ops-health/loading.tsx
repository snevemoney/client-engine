export default function OpsHealthLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-40 rounded bg-muted" />
      <div className="h-4 w-56 rounded bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 rounded-lg bg-muted" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-48 rounded-lg bg-muted" />
        <div className="h-48 rounded-lg bg-muted" />
      </div>
      <div className="h-40 rounded-lg bg-muted" />
    </div>
  );
}
