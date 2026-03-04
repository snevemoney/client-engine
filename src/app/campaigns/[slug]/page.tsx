import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const campaign = await db.campaign.findUnique({
    where: { slug },
    select: { published: true, title: true },
  });
  if (!campaign || !campaign.published) return { title: "Campaign | Evens Louis" };

  return {
    title: `${campaign.title} | Evens Louis`,
    description: `Case studies and proof for ${campaign.title}.`,
    openGraph: {
      title: campaign.title,
      url: `https://evenslouis.ca/campaigns/${slug}`,
    },
  };
}

export default async function CampaignPage({ params }: Props) {
  const { slug } = await params;
  const campaign = await db.campaign.findUnique({ where: { slug } });
  if (!campaign || !campaign.published) notFound();

  const projects = await db.project.findMany({
    where: {
      proofPublishedAt: { not: null },
      campaignTags: { has: campaign.filterTag },
    },
    orderBy: { proofPublishedAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <header className="mb-12">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{campaign.title}</h1>
        </header>

        {projects.length === 0 ? (
          <p className="text-neutral-500">No proof pages yet for this campaign.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/proof/${p.slug}`}
                className="block rounded-lg border border-neutral-800 p-4 hover:border-neutral-600 transition-colors"
              >
                <h2 className="font-medium text-neutral-200 mb-2">
                  {p.proofHeadline ?? p.name}
                </h2>
                {p.techStack && p.techStack.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {p.techStack.slice(0, 4).map((t) => (
                      <span
                        key={t}
                        className="rounded bg-neutral-800 px-1.5 py-0.5 text-xs text-neutral-400"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {p.proofSummary && (
                  <p className="text-sm text-neutral-500 line-clamp-2">{p.proofSummary}</p>
                )}
              </Link>
            ))}
          </div>
        )}

        {campaign.ctaLabel && campaign.ctaUrl && (
          <div className="mt-12 pt-8 border-t border-neutral-800 text-center">
            <a
              href={campaign.ctaUrl}
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              {campaign.ctaLabel}
            </a>
          </div>
        )}

        <footer className="mt-12 pt-8 border-t border-neutral-800">
          <Link
            href="/work"
            className="text-sm text-neutral-500 hover:text-neutral-300"
          >
            View portfolio
          </Link>
        </footer>
      </div>
    </div>
  );
}
