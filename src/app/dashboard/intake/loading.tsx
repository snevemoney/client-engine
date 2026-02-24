export default function IntakeLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-48 bg-neutral-800 rounded animate-pulse" />
        <div className="h-4 w-64 mt-2 bg-neutral-800 rounded animate-pulse" />
      </div>
      <div className="h-10 w-full max-w-md bg-neutral-800 rounded animate-pulse" />
      <div className="h-64 border border-neutral-700 rounded-lg animate-pulse" />
    </div>
  );
}
