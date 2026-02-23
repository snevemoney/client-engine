import { getOpsHealth } from "@/lib/ops/opsHealth";
import { OpsHealthPanel } from "@/components/dashboard/ops-health/OpsHealthPanel";

export const dynamic = "force-dynamic";

export default async function OpsHealthPage() {
  const data = await getOpsHealth();

  return <OpsHealthPanel data={data} />;
}
