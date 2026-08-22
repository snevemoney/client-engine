import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteLink } from "@/components/site/SiteLink";
import { CardMedia } from "@/components/site/CardMedia";
import { resolveCaseCopy } from "@/lib/site/case-copy";
import { galleryMediaItems } from "@/lib/site/gallery-media";
import { isVideoPath } from "@/lib/site/media-path";
import { catalogProjectSelect } from "@/lib/site/project-select";

export const revalidate = 60;

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let project;
  try {
    project = await db.project.findUnique({ where: { slug }, select: catalogProjectSelect });
  } catch (e) {
    console.error("[work/[slug]] DB query failed", { slug }, e);
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center">
        <div className="text-center px-6">
          <h1 className="text-xl font-medium text-neutral-200 mb-2">Something went wrong</h1>
          <p className="text-neutral-400 text-sm">We couldn&apos;t load this project. Please try again later.</p>
          <SiteLink href="/work" className="mt-4 inline-block text-sm text-emerald-400 hover:text-emerald-300">
            Back to Work
          </SiteLink>
        </div>
      </div>
    );
  }
  if (!project) notFound();

  const copy = resolveCaseCopy(project);
  const gallery = galleryMediaItems(project.screenshots);
  const galleryHeading = gallery.length > 0 && gallery.every(isVideoPath) ? "Preview" : "Screenshots";

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <SiteHeader active="work" />

      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex flex-col lg:flex-row lg:gap-12">
          <div className="flex-1 min-w-0">
        <SiteLink href="/work" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200 mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Work
        </SiteLink>

        <div className="mb-8">
          <div className="flex items-center gap-3 flex-wrap mb-3">
            <h1 className="text-4xl font-light tracking-tight">{project.name}</h1>
            {copy.proofOnly && (
              <span className="text-xs uppercase tracking-wider px-2.5 py-1 rounded-md bg-neutral-800 border border-neutral-700 text-neutral-400">
                Proof / concept
              </span>
            )}
          </div>

          {project.techStack.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-8">
              {project.techStack.map((t) => (
                <span key={t} className="text-xs px-2.5 py-1 rounded-md bg-neutral-800/50 border border-neutral-700/50 text-neutral-300">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mb-12 rounded-lg border border-neutral-800 bg-neutral-900/30 p-6 space-y-4">
          <h2 className="text-lg font-medium text-neutral-200">At a glance</h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Problem</dt>
              <dd className="text-sm text-neutral-400 mt-0.5">{copy.problem}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Build</dt>
              <dd className="text-sm text-neutral-300 mt-0.5">{copy.description || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Result</dt>
              <dd className="text-sm text-neutral-400 mt-0.5">{copy.result}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Next step</dt>
              <dd className="mt-0.5">
                <SiteLink href="/contact" className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-400 hover:text-emerald-300">
                  Request audit <ArrowRight className="w-3.5 h-3.5" />
                </SiteLink>
              </dd>
            </div>
          </dl>
        </div>

        {gallery.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-medium mb-6">{galleryHeading}</h2>
            <div className="grid gap-4">
              {gallery.map((src, i) => (
                <div key={i} className="border border-neutral-800/50 rounded-xl overflow-hidden">
                  <CardMedia
                    src={src}
                    alt={`${project.name} screenshot ${i + 1}`}
                    width={1200}
                    height={675}
                    className="w-full h-auto"
                    siblings={project.screenshots}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

            <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 mb-8">
              <h3 className="text-sm font-medium text-neutral-300 mb-2">Next step</h3>
              <p className="text-neutral-400 text-sm mb-3">Want similar outcomes for your business? Request a workflow audit.</p>
              <SiteLink href="/contact" className="inline-flex items-center gap-2 bg-white text-neutral-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-neutral-200 transition-colors">
                Request audit <ArrowRight className="w-3.5 h-3.5" />
              </SiteLink>
            </div>
          </div>

          <aside className="lg:w-64 flex-shrink-0">
            <div className="lg:sticky lg:top-24 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
              <h3 className="text-sm font-medium text-neutral-300 mb-2">Want this for your business?</h3>
              <p className="text-neutral-400 text-xs mb-4">Request a workflow audit or book a strategy call.</p>
              <SiteLink href="/contact" className="block w-full text-center bg-white text-neutral-900 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-neutral-200 transition-colors">
                Request a workflow audit
              </SiteLink>
            </div>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
