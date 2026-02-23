import { getSalesLeakDashboard } from "@/lib/ops/salesLeakDashboard";
import { SalesLeakDashboardClient } from "@/components/dashboard/sales-leak/SalesLeakDashboardClient";

export const dynamic = "force-dynamic";

export default async function SalesLeakPage() {
  const data = await getSalesLeakDashboard();

  return <SalesLeakDashboardClient data={data} />;
}
