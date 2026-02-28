import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import dynamicImport from "next/dynamic";
import { StrategyPipelineContext } from "@/components/dashboard/strategy/StrategyPipelineContext";

const StrategyQuadrantPanel = dynamicImport(
  () => import("@/components/dashboard/strategy/StrategyQuadrantPanel"),
  { loading: () => <div className="animate-pulse h-96 bg-neutral-900/50 rounded-lg" /> }
);

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
