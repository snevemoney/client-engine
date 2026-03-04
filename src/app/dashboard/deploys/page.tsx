import { db } from "@/lib/db";
import { DeploysTable } from "./deploys-table";
import { ProductionDeployCard } from "@/components/dashboard/deploys/ProductionDeployCard";

export const dynamic = "force-dynamic";

type Filter = "all" | "unpaid" | "invoiced" | "paid";

function buildWhere(filter: Filter) {
  if (filter === "all") return undefined;
  if (filter === "unpaid")
    return { OR: [{ paymentStatus: "unpaid" }, { paymentStatus: null }] };
  if (filter === "invoiced")
    return { paymentStatus: { in: ["invoiced", "partial"] } };
  if (filter === "paid") return { paymentStatus: "paid" };
  return undefined;
}

export default async function DeploysPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; highlight?: string }>;
}) {
  const { filter: raw, highlight: highlightProjectId } = await searchParams;
  const filter: Filter =
    raw === "unpaid" || raw === "invoiced" || raw === "paid" ? raw : "all";
  const where = buildWhere(filter);

  const projects = await db.project.findMany({
    where,
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

      <DeploysTable
        projects={projects.map((p) => ({
          ...p,
          paymentAmount:
            p.paymentAmount != null ? Number(p.paymentAmount) : null,
          proofPublishedAt: p.proofPublishedAt?.toISOString() ?? null,
        }))}
        filter={filter}
        highlightProjectId={highlightProjectId ?? null}
      />
    </div>
  );
}
