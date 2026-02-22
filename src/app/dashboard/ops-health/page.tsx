import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getOpsHealth } from "@/lib/ops/opsHealth";
import { OpsHealthPanel } from "@/components/dashboard/ops-health/OpsHealthPanel";

export const dynamic = "force-dynamic";

export default async function OpsHealthPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const data = await getOpsHealth();

  return <OpsHealthPanel data={data} />;
}
