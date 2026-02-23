import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DemoRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await db.project.findUnique({ where: { slug } });
  if (!project) notFound();

  if (project.demoUrl) {
    redirect(project.demoUrl);
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center px-6">
      <div className="max-w-md text-center space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
        <p className="text-neutral-400">
          This demo is not deployed yet. When it is, this page will redirect to the live app.
        </p>
        <Link
          href="/work"
          className="inline-block text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          View portfolio →
        </Link>
      </div>
    </div>
  );
}
