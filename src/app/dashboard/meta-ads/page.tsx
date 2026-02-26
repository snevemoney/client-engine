import { MetaAdsPageClient } from "@/components/dashboard/meta-ads/MetaAdsPageClient";
import { getConnectionStatus } from "@/lib/integrations/connection-data";

export const dynamic = "force-dynamic";

export default async function MetaAdsPage() {
  const metaConnection = await getConnectionStatus("meta");

  return (
    <div>
      {metaConnection && (
        <div className="mb-4 flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            metaConnection.mode === "live" ? "bg-green-950/40 text-green-400" :
            metaConnection.mode === "mock" ? "bg-amber-950/40 text-amber-400" :
            metaConnection.mode === "off" ? "bg-neutral-800/60 text-neutral-500" :
            "bg-blue-950/40 text-blue-400"
          }`}>
            Meta: {metaConnection.mode}
          </span>
          {metaConnection.hasCredentials && (
            <span className="text-[10px] text-neutral-600">Credentials configured</span>
          )}
        </div>
      )}
      <MetaAdsPageClient />
    </div>
  );
}
