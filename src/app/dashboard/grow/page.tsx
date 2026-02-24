import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Target, TrendingUp, Compass } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function GrowPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">GROW</h1>
        <p className="text-sm text-neutral-400 mt-1">
          A practical growth system to turn ideas into measurable results. Scale with structure.
        </p>
      </div>
      <div className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <Target className="w-6 h-6 text-neutral-500 shrink-0" />
          <div>
            <h2 className="font-medium text-neutral-200">What it helps you do</h2>
            <ul className="mt-2 text-sm text-neutral-400 space-y-1 list-disc list-inside">
              <li>Scale your business using proven frameworks</li>
              <li>Improve systems, marketing, and leadership</li>
              <li>Identify bottlenecks and remove them</li>
              <li>Build momentum with focused execution</li>
              <li>Learn how top leaders grow sustainably</li>
            </ul>
          </div>
        </div>
        <p className="text-sm text-neutral-500">
          <strong className="text-neutral-400">Outcome:</strong> Consistent progress instead of random effort.
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
          <TrendingUp className="w-4 h-4" />
          Planning
        </Link>
        <Link
          href="/dashboard/scoreboard"
          className="inline-flex items-center gap-2 rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
        >
          <Target className="w-4 h-4" />
          Scoreboard
        </Link>
      </div>
    </div>
  );
}
