import Link from "next/link";
import { db } from "@/lib/db";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { LeadCaptureForm } from "@/components/site/LeadCaptureForm";

export const dynamic = "force-dynamic";

export default async function WorkPage() {
  let projects: Awaited<ReturnType<typeof db.project.findMany>> = [];
  try {
    projects = await db.project.findMany({
      where: { status: { not: "archived" } },
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    console.error("[work] Failed to load projects:", err);
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800/50 backdrop-blur-sm sticky top-0 z-50 bg-neutral-950/80">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">evenslouis</Link>
          <nav className="flex items-center gap-6 text-sm text-neutral-400">
            <Link href="/work" className="text-neutral-100">Work</Link>
            <Link href="/#contact" className="hover:text-neutral-100 transition-colors">Contact</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200 mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Home
        </Link>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6 mb-12">
          <p className="text-neutral-400 text-sm mb-2">Proof of execution</p>
          <h1 className="text-3xl font-light tracking-tight mb-2">Work</h1>
          <p className="text-neutral-400 mb-4">Selected projects and case studies. Want similar outcomes for your business?</p>
          <a href="/#contact" className="inline-flex items-center gap-2 bg-white text-neutral-900 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-neutral-200 transition-colors">
            Request a workflow audit <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        {projects.length === 0 ? (
          <div className="border border-neutral-800 rounded-lg p-12 text-center text-neutral-500">
            Projects will appear here once deployed.
          </div>
        ) : (
          <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/work/${p.slug}`}
                className="border border-neutral-800/50 rounded-xl p-6 hover:border-neutral-700/50 transition-colors group"
              >
                {p.screenshots.length > 0 && (
                  <div className="rounded-lg overflow-hidden mb-4 border border-neutral-800/30">
                    <img
                      src={p.screenshots[0]}
                      alt={p.name}
                      className="w-full h-40 object-cover object-top"
                    />
                  </div>
                )}
                <h3 className="font-medium mb-2 group-hover:text-white transition-colors">{p.name}</h3>
                <p className="text-sm text-neutral-400 line-clamp-2 mb-3">{p.description}</p>
                {p.techStack.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {p.techStack.slice(0, 4).map((t) => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded bg-neutral-800/50 border border-neutral-700/50 text-neutral-400">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
          <div className="mt-16 rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
            <h2 className="text-lg font-medium mb-2">Want this for your business?</h2>
            <p className="text-neutral-400 text-sm mb-4">Request a workflow audit. One clear next step.</p>
            <a href="/#contact" className="inline-flex items-center gap-2 bg-white text-neutral-900 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-neutral-200 transition-colors">
              Request a workflow audit <ArrowRight className="w-4 h-4" />
            </a>
          </div>
          </>
        )}
      </main>

      <footer className="border-t border-neutral-800/50 py-8 mt-12">
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
