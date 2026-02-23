export default function DashboardLoading() {
  return (
    <div className="space-y-6 min-w-0 animate-pulse">
      <div className="h-8 w-48 rounded bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-lg bg-muted" />
        ))}
      </div>
      <div className="h-48 rounded-lg bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-40 rounded-lg bg-muted" />
        <div className="h-40 rounded-lg bg-muted" />
      </div>
    </div>
  );
}
