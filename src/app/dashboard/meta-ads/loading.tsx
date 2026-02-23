export default function MetaAdsLoading() {
  return (
    <div className="space-y-6 animate-pulse min-w-0">
      <div className="h-8 w-48 rounded bg-neutral-800" />
      <div className="flex gap-2 border-b border-neutral-800 pb-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 w-24 rounded bg-neutral-800" />
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-20 rounded-lg bg-neutral-800" />
        ))}
      </div>
      <div className="h-64 rounded-lg bg-neutral-800" />
    </div>
  );
}
