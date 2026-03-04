import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PortalClient } from "./PortalClient";

export const dynamic = "force-dynamic";

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const project = await db.deliveryProject.findUnique({
    where: { clientToken: token },
    select: {
      id: true,
      title: true,
      status: true,
      clientName: true,
      builderPreviewUrl: true,
      builderLiveUrl: true,
    },
  });

  if (!project) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-4 md:p-8">
      <div className="mx-auto max-w-xl">
        <h1 className="text-xl font-semibold text-white mb-1">{project.title}</h1>
        {project.clientName && (
          <p className="text-neutral-400 text-sm mb-4">{project.clientName}</p>
        )}
        <p className="text-neutral-500 text-sm mb-6 capitalize">
          Status: {project.status.replace(/_/g, " ")}
        </p>

        <div className="space-y-4 mb-8">
          {project.builderPreviewUrl && (
            <a
              href={project.builderPreviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 rounded-lg border border-neutral-700 bg-neutral-900/50 hover:bg-neutral-800 transition-colors"
            >
              <span className="font-medium text-white">Preview</span>
              <span className="block text-sm text-neutral-400 truncate mt-1">
                {project.builderPreviewUrl}
              </span>
            </a>
          )}
          {project.builderLiveUrl && (
            <a
              href={project.builderLiveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 rounded-lg border border-neutral-700 bg-neutral-900/50 hover:bg-neutral-800 transition-colors"
            >
              <span className="font-medium text-white">Live site</span>
              <span className="block text-sm text-neutral-400 truncate mt-1">
                {project.builderLiveUrl}
              </span>
            </a>
          )}
          {!project.builderPreviewUrl && !project.builderLiveUrl && (
            <p className="text-neutral-500 text-sm">No preview or live URLs yet.</p>
          )}
        </div>

        <PortalClient token={token} />
      </div>
    </div>
  );
}
