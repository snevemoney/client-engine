import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { DecisionQueue } from "./DecisionQueue";

export const dynamic = "force-dynamic";

const DECISIONS_WHERE = {
  status: { not: "REJECTED" as const },
  approvedAt: null,
  scoreVerdict: { in: ["ACCEPT", "MAYBE"] as string[] },
  artifacts: {
    some: { type: { in: ["positioning", "proposal"] as string[] } },
  },
};

export default async function DecisionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const leads = await db.lead.findMany({
    where: DECISIONS_WHERE,
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      artifacts: { select: { type: true, title: true } },
    },
  });

  const pending = leads.map((l) => {
    const arts = (l as { artifacts: { type: string; title: string | null }[] }).artifacts;
    const hasProposal = arts.some((a) => a.type === "proposal");
    const hasPositioning = arts.some((a) => a.type === "positioning" && a.title === "POSITIONING_BRIEF");
    return {
      id: l.id,
      title: l.title,
      status: l.status,
      scoreVerdict: l.scoreVerdict,
      score: l.score,
      source: l.source,
      hasProposal,
      hasPositioning,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Decisions</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Leads ready for review. Approve proposals or review positioning before moving forward.
        </p>
      </div>
      <DecisionQueue pending={pending} />
    </div>
  );
}
