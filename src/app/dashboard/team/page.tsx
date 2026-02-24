import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Users, Compass, Target } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team and Leadership</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Sharpen judgment and operate like a strategist. Build the right team, improve decision-making.
        </p>
      </div>
      <div className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <Users className="w-6 h-6 text-neutral-500 shrink-0" />
          <div>
            <h2 className="font-medium text-neutral-200">What you will master</h2>
            <ul className="mt-2 text-sm text-neutral-400 space-y-1 list-disc list-inside">
              <li>Knowing yourself (self-awareness as a leader)</li>
              <li>Mastering reason and decision-making</li>
              <li>Building the right team</li>
              <li>Strategy for scaling</li>
              <li>Power plays (positioning, leverage, timing, influence)</li>
            </ul>
          </div>
        </div>
        <p className="text-sm text-neutral-500">
          <strong className="text-neutral-400">Outcome:</strong> Stronger decisions, better leadership, more control over growth.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/dashboard/strategy"
          className="inline-flex items-center gap-2 rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
        >
          <Compass className="w-4 h-4" />
          Strategy
        </Link>
        <Link
          href="/dashboard/planning"
          className="inline-flex items-center gap-2 rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
        >
          <Target className="w-4 h-4" />
          Planning
        </Link>
      </div>
    </div>
  );
}
