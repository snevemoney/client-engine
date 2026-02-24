import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ScoreboardView } from "@/components/dashboard/scoreboard/ScoreboardView";

export const dynamic = "force-dynamic";

export default async function ScoreboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Scoreboard</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Weekly execution at a glance: targets, priorities, review status.
        </p>
      </div>
      <ScoreboardView />
    </div>
  );
}
