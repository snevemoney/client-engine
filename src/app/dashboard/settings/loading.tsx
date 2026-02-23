export default function SettingsLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-8 w-32 rounded bg-muted" />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="border border-neutral-800 rounded-lg p-6 space-y-4">
          <div className="h-5 w-40 rounded bg-muted" />
          <div className="space-y-3">
            <div className="flex justify-between">
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="h-4 w-12 rounded bg-muted" />
            </div>
            <div className="flex justify-between">
              <div className="h-4 w-28 rounded bg-muted" />
              <div className="h-4 w-16 rounded bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
