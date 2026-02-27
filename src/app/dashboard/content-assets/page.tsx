import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ContentAssetList } from "@/components/dashboard/content-assets/ContentAssetList";

export const dynamic = "force-dynamic";

export default async function ContentAssetsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const assets = await db.contentAsset.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const serialized = assets.map((a) => ({
    id: a.id,
    platform: a.platform,
    title: a.title,
    url: a.url,
    publishedAt: a.publishedAt?.toISOString() ?? null,
    topicTag: a.topicTag,
    format: a.format,
    ctaType: a.ctaType,
    views: a.views,
    comments: a.comments,
    inboundLeads: a.inboundLeads,
    qualifiedLeads: a.qualifiedLeads,
    wonDeals: a.wonDeals,
    cashCollected: a.cashCollected,
    notes: a.notes,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Content Assets</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Track content performance across platforms and link to inbound leads.
        </p>
      </div>
      <ContentAssetList assets={serialized} />
    </div>
  );
}
