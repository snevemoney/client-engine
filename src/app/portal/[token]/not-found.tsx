import Link from "next/link";

export default function PortalNotFound() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-xl font-semibold text-white mb-2">Link not found</h1>
      <p className="text-neutral-400 text-sm mb-4">{`This portal link may have expired or is invalid.`}</p>
      <Link href="/" className="text-emerald-400 hover:underline text-sm">← Back to home</Link>
    </div>
  );
}
