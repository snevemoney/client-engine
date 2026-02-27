import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { StrategyQuadrantPanel } from "@/components/dashboard/strategy/StrategyQuadrantPanel";
import { StrategyPipelineContext } from "@/components/dashboard/strategy/StrategyPipelineContext";

export const dynamic = "force-dynamic";

export default async function StrategyPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-6 min-w-0">
      <StrategyPipelineContext />
      <StrategyQuadrantPanel />
    </div>
  );
}
