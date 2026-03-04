import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = await db.project.findUnique({
    where: { slug },
    select: { proofPublishedAt: true, proofHeadline: true, proofSummary: true, name: true },
  });
  if (!project || !project.proofPublishedAt) return { title: "Proof | Evens Louis" };

  const title = project.proofHeadline ?? project.name;
  const description = (project.proofSummary ?? project.name).slice(0, 160);

  return {
    title: `${title} | Evens Louis`,
    description,
    openGraph: {
      title,
      description,
      url: `https://evenslouis.ca/proof/${slug}`,
    },
  };
}

export default async function ProofPage({ params }: Props) {
  const { slug } = await params;
  const project = await db.project.findUnique({ where: { slug } });
  if (!project || !project.proofPublishedAt) notFound();

  const headline = project.proofHeadline ?? project.name;
  const summary = project.proofSummary ?? "";
  const testimonial = project.proofTestimonial ?? null;
  const techStack = project.techStack ?? [];
  const screenshots = project.screenshots ?? [];
  const demoUrl = project.demoUrl ?? null;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <header className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4">{headline}</h1>
          {techStack.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {techStack.map((t) => (
                <span
                  key={t}
                  className="rounded-md bg-neutral-800 px-2.5 py-0.5 text-xs font-medium text-neutral-300"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </header>

        {summary && (
          <div className="prose prose-invert prose-neutral max-w-none mb-8">
            <p className="text-neutral-300 whitespace-pre-wrap">{summary}</p>
          </div>
        )}

        {screenshots.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 mb-8">
            {screenshots.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg overflow-hidden border border-neutral-800 hover:border-neutral-600 transition-colors"
              >
                <img
                  src={url}
                  alt={`Screenshot ${i + 1}`}
                  className="w-full h-auto object-cover"
                />
              </a>
            ))}
          </div>
        )}

        {testimonial && (
          <blockquote className="border-l-4 border-emerald-600 pl-4 py-2 mb-8 text-neutral-300 italic">
            &ldquo;{testimonial}&rdquo;
          </blockquote>
        )}

        <footer className="mt-12 pt-8 border-t border-neutral-800">
          {demoUrl ? (
            <a
              href={demoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              View live demo
            </a>
          ) : (
            <Link
              href="/work"
              className="inline-flex items-center gap-2 rounded-md bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-700"
            >
              View portfolio
            </Link>
          )}
        </footer>
      </div>
    </div>
  );
}
