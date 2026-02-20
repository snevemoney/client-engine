import Link from "next/link";
import { db } from "@/lib/db";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WorkPage() {
  const projects = await db.project.findMany({
    where: { status: "live" },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800/50 backdrop-blur-sm sticky top-0 z-50 bg-neutral-950/80">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">evenslouis</Link>
          <nav className="flex items-center gap-6 text-sm text-neutral-400">
            <Link href="/work" className="text-neutral-100">Work</Link>
            <a href="/#contact" className="hover:text-neutral-100 transition-colors">Contact</a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200 mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Home
        </Link>
        <h1 className="text-4xl font-light tracking-tight mb-2">Work</h1>
        <p className="text-neutral-400 mb-12">Selected projects and case studies.</p>

        {projects.length === 0 ? (
          <div className="border border-neutral-800 rounded-lg p-12 text-center text-neutral-500">
            Projects will appear here once deployed.
          </div>
        ) : (
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
