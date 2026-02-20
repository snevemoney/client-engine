import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await db.project.findUnique({ where: { slug } });
  if (!project) notFound();

  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-800">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">evenslouis</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/work" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200 mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to Work
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight mb-2">{project.name}</h1>
        {project.demoUrl && (
          <a
            href={project.demoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200 mb-6"
          >
            Live demo <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
        {project.description && (
          <div className="prose prose-invert prose-sm max-w-none mt-6">
            <p className="whitespace-pre-wrap text-neutral-300">{project.description}</p>
          </div>
        )}
      </main>
    </div>
  );
}
