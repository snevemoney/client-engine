import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PlanningThemesSection } from "@/components/dashboard/founder-os/PlanningThemesSection";
import { Compass, ClipboardCheck, Target } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PlanningPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Planning</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Build a business plan you actually use. Set themes, targets, priorities, and execution rhythms.
        </p>
      </div>
      <section className="rounded-lg border border-neutral-800 p-6">
        <PlanningThemesSection />
      </section>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/dashboard/strategy"
          className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-4 hover:border-neutral-600 hover:bg-neutral-800/50 transition-colors"
        >
          <div className="flex items-start gap-3">
            <Compass className="w-5 h-5 text-neutral-400 shrink-0" />
            <div>
              <h3 className="font-medium text-neutral-200">Strategy</h3>
              <p className="text-xs text-neutral-500 mt-0.5">Weekly campaign, targets, priorities, risks</p>
            </div>
          </div>
        </Link>
        <Link
          href="/dashboard/reviews"
          className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-4 hover:border-neutral-600 hover:bg-neutral-800/50 transition-colors"
        >
          <div className="flex items-start gap-3">
            <ClipboardCheck className="w-5 h-5 text-neutral-400 shrink-0" />
            <div>
              <h3 className="font-medium text-neutral-200">Reviews</h3>
              <p className="text-xs text-neutral-500 mt-0.5">Weekly review rhythm</p>
            </div>
          </div>
        </Link>
        <Link
          href="/dashboard/scoreboard"
          className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-4 hover:border-neutral-600 hover:bg-neutral-800/50 transition-colors"
        >
          <div className="flex items-start gap-3">
            <Target className="w-5 h-5 text-neutral-400 shrink-0" />
            <div>
              <h3 className="font-medium text-neutral-200">Scoreboard</h3>
              <p className="text-xs text-neutral-500 mt-0.5">Execution at a glance</p>
            </div>
          </div>
        </Link>
      </div>
      <section className="rounded-lg border border-neutral-800 p-4 text-sm text-neutral-500">
        <p>
          <strong className="text-neutral-400">Outcome:</strong> A living execution system that drives results week after week.
        </p>
      </section>
    </div>
  );
}
