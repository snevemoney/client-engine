import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSalesLeakDashboard } from "@/lib/ops/salesLeakDashboard";
import { SalesLeakDashboardClient } from "@/components/dashboard/sales-leak/SalesLeakDashboardClient";

export const dynamic = "force-dynamic";

export default async function SalesLeakPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const data = await getSalesLeakDashboard();

  return <SalesLeakDashboardClient data={data} />;
}
