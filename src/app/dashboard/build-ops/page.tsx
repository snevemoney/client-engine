import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { BuildOpsPageClient } from "@/components/dashboard/build-ops/BuildOpsPageClient";

export const dynamic = "force-dynamic";

export default async function BuildOpsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const tasks = await db.buildTask.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      linkedLead: { select: { id: true, title: true } },
    },
  });

  const serialized = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    type: t.type,
    priority: t.priority,
    linkedLeadId: t.linkedLeadId,
    linkedLead: t.linkedLead,
    linkedCriticismItem: t.linkedCriticismItem,
    expectedOutcome: t.expectedOutcome,
    status: t.status,
    cursorPrompt: t.cursorPrompt,
    prSummary: t.prSummary,
    humanApproved: t.humanApproved,
    businessImpact: t.businessImpact,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Build Ops Queue</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Bugs, refactors, features, guardrails, template extraction. Give Cursor Cloud Agent a clear list; review before merge.
        </p>
      </div>
      <BuildOpsPageClient initialTasks={serialized} />
    </div>
  );
}
