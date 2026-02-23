import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, ExternalLink, Github } from "lucide-react";
import { SiteFooter } from "@/components/site/SiteFooter";

export const revalidate = 60;

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await db.project.findUnique({ where: { slug } });
  if (!project) notFound();

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800/50 backdrop-blur-sm sticky top-0 z-50 bg-neutral-950/80">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">evenslouis</Link>
          <nav className="flex items-center gap-6 text-sm text-neutral-400">
            <Link href="/work" className="hover:text-neutral-100 transition-colors">Work</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex flex-col lg:flex-row lg:gap-12">
          <div className="flex-1 min-w-0">
        <Link href="/work" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200 mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Work
        </Link>

        <div className="mb-8">
          <h1 className="text-4xl font-light tracking-tight mb-3">{project.name}</h1>

          <div className="flex items-center gap-3 flex-wrap mb-6">
            {project.repoUrl && (
              <a
                href={project.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                <Github className="w-4 h-4" /> Source
              </a>
            )}
            {project.demoUrl && (
              <a
                href={project.demoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Live Demo
              </a>
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

        {/* Structured: Problem / Build / Result / Next step */}
        <div className="mb-12 rounded-lg border border-neutral-800 bg-neutral-900/30 p-6 space-y-4">
          <h2 className="text-lg font-medium text-neutral-200">At a glance</h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Problem</dt>
              <dd className="text-sm text-neutral-400 mt-0.5">—</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Build</dt>
              <dd className="text-sm text-neutral-300 mt-0.5">{project.description ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Result</dt>
              <dd className="text-sm text-neutral-400 mt-0.5">—</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Next step</dt>
              <dd className="mt-0.5">
                <Link href="/#contact" className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-400 hover:text-emerald-300">
                  Request audit <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </dd>
            </div>
          </dl>
        </div>

        {project.screenshots.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-medium mb-6">Screenshots</h2>
            <div className="grid gap-4">
              {project.screenshots.map((src, i) => (
                <div key={i} className="border border-neutral-800/50 rounded-xl overflow-hidden">
                  <Image
                    src={src}
                    alt={`${project.name} screenshot ${i + 1}`}
                    width={1200}
                    height={675}
                    className="w-full h-auto"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

            <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 mb-8">
              <h3 className="text-sm font-medium text-neutral-300 mb-2">Next step</h3>
              <p className="text-neutral-400 text-sm mb-3">Want similar outcomes for your business? Request a workflow audit.</p>
              <Link href="/#contact" className="inline-flex items-center gap-2 bg-white text-neutral-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-neutral-200 transition-colors">
                Request audit <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <aside className="lg:w-64 flex-shrink-0">
            <div className="lg:sticky lg:top-24 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
              <h3 className="text-sm font-medium text-neutral-300 mb-2">Want this for your business?</h3>
              <p className="text-neutral-400 text-xs mb-4">Request a workflow audit or book a strategy call.</p>
              <Link href="/#contact" className="block w-full text-center bg-white text-neutral-900 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-neutral-200 transition-colors">
                Request a workflow audit
              </Link>
            </div>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
