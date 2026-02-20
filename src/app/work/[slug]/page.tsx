import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ExternalLink, Github } from "lucide-react";

export const dynamic = "force-dynamic";

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

        {project.description && (
          <div className="mb-12">
            <p className="text-neutral-300 leading-relaxed text-lg max-w-3xl">{project.description}</p>
          </div>
        )}

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
                    unoptimized
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-neutral-800/50 py-8">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-neutral-500">&copy; {new Date().getFullYear()} Evens Louis</span>
          <div className="flex items-center gap-6 text-sm text-neutral-500">
            <Link href="/work" className="hover:text-neutral-300 transition-colors">Work</Link>
            <a href="mailto:contact@evenslouis.ca" className="hover:text-neutral-300 transition-colors">Email</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
