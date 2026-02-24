import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SignalsDashboard } from "@/components/dashboard/signals/SignalsDashboard";

export const dynamic = "force-dynamic";

export default async function SignalsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Signal Engine</h1>
        <p className="text-sm text-neutral-400 mt-1">
          RSS/News feeds: add sources, sync, score, and filter by relevance.
        </p>
      </div>
      <SignalsDashboard />
    </div>
  );
}
