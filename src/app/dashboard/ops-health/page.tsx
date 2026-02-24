import { getOpsHealth } from "@/lib/ops/opsHealth";
import { getIntegrationSummary } from "@/lib/integrations/registry";
import { OpsHealthPanel } from "@/components/dashboard/ops-health/OpsHealthPanel";

export const dynamic = "force-dynamic";

export default async function OpsHealthPage() {
  const data = await getOpsHealth();
  const integrationSummary = getIntegrationSummary();

  return <OpsHealthPanel data={data} integrationSummary={integrationSummary} />;
}
