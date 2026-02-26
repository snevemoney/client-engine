import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SignalsDashboard } from "@/components/dashboard/signals/SignalsDashboard";
import { getConnectionStatus } from "@/lib/integrations/connection-data";

export const dynamic = "force-dynamic";

export default async function SignalsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const rssConnection = await getConnectionStatus("rss");

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Signal Engine</h1>
          <p className="text-sm text-neutral-400 mt-1">
            RSS/News feeds: add sources, sync, score, and filter by relevance.
          </p>
        </div>
        {rssConnection && (
          <div className="text-xs text-neutral-500 text-right">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
              rssConnection.mode === "live" ? "bg-green-950/40 text-green-400" :
              rssConnection.mode === "mock" ? "bg-amber-950/40 text-amber-400" :
              "bg-neutral-800/60 text-neutral-500"
            }`}>
              RSS: {rssConnection.mode}
            </span>
            {rssConnection.lastSyncedAt && (
              <p className="mt-0.5">
                Last sync: {new Date(rssConnection.lastSyncedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        )}
      </div>
      <SignalsDashboard />
    </div>
  );
}
