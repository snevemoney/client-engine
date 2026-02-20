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
    <div className="min-h-screen">
      <header className="border-b border-neutral-800">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">evenslouis</Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200 mb-8">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Work</h1>
        <p className="text-neutral-400 mb-10">Selected projects and case studies.</p>

        {projects.length === 0 ? (
          <div className="border border-neutral-800 rounded-lg p-12 text-center text-neutral-500">
            Projects will appear here once deployed.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/work/${p.slug}`}
                className="border border-neutral-800 rounded-lg p-5 hover:border-neutral-700 transition-colors"
              >
                <h3 className="font-medium mb-1">{p.name}</h3>
                <p className="text-sm text-neutral-400 line-clamp-2">{p.description}</p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
