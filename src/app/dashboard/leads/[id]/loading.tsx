export default function LeadDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-5 w-20 rounded bg-muted" />
        <div className="h-8 w-64 rounded bg-muted" />
        <div className="h-6 w-20 rounded bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="h-20 rounded-lg bg-muted" />
        <div className="h-20 rounded-lg bg-muted" />
        <div className="h-20 rounded-lg bg-muted" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="h-48 rounded-lg bg-muted" />
          <div className="h-32 rounded-lg bg-muted" />
        </div>
        <div className="space-y-4">
          <div className="h-64 rounded-lg bg-muted" />
          <div className="h-32 rounded-lg bg-muted" />
        </div>
      </div>
    </div>
  );
}
