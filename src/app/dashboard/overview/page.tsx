import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { OverviewCards } from "@/components/dashboard/founder-os/OverviewCards";
import { OverviewLiveStats } from "@/components/dashboard/founder-os/OverviewLiveStats";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Founder Operating System</h1>
        <p className="text-sm text-neutral-400 mt-1">
          A practical system for entrepreneurs who want to improve sales, sharpen strategy, and scale with structure.
        </p>
      </div>
      <OverviewLiveStats />
      <OverviewCards />
      <section className="rounded-lg border border-neutral-800 p-4 text-sm text-neutral-500">
        <p>
          <strong className="text-neutral-400">Weekly rhythm:</strong> Plan in Strategy → Execute → Review at week end → Update Scoreboard.
          Use Settings → Integrations to connect platforms (MOCK/MANUAL mode works without external access).
        </p>
      </section>
    </div>
  );
}
