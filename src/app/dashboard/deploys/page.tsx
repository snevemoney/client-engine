import { db } from "@/lib/db";
import { DeploysTable } from "./deploys-table";
import { ProductionDeployCard } from "@/components/dashboard/deploys/ProductionDeployCard";

export const dynamic = "force-dynamic";

export default async function DeploysPage() {
  const projects = await db.project.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: { lead: { select: { id: true, title: true, status: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Deploys</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Set demo URLs for projects. Visitors to <code className="text-neutral-500">/demos/[slug]</code> are redirected to the demo URL.
        </p>
      </div>

      <ProductionDeployCard />

      <DeploysTable projects={projects} />

      {projects.length === 0 && (
        <div className="border border-neutral-800 rounded-lg p-8 text-center text-neutral-500">
          No projects yet. Create a project via &quot;Start Build&quot; on a lead.
        </div>
      )}
    </div>
  );
}
